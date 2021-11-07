const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/bills.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');
const Supplier = require('../models/suppliers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { startDate, endDate } = req.query;

    const getExpenses = async () => {
        let [rawMaterialExpenses, shopExpenses, salariesExpenses, bills, refundBills] = await Promise.all([
            await mongoose.model('RawMaterialExpenses').aggregate([
                {
                    $match: { createdAt: { $gte: startDate, $lte: endDate } },
                },
                { $group: { _id: null, price: { $sum: '$price' } } },
            ]),
            await mongoose.model('ShopExpenses').aggregate([
                {
                    $match: { createdAt: { $gte: startDate, $lte: endDate } },
                },
                { $group: { _id: null, price: { $sum: '$price' } } },
            ]),
            await mongoose.model('SalariesExpense').aggregate([
                {
                    $match: { createdAt: { $gte: startDate, $lte: endDate } },
                },
                { $group: { _id: null, price: { $sum: '$amount' } } },
            ]),
        ]);

        rawMaterialExpenses = rawMaterialExpenses[0]?.price;
        shopExpenses = shopExpenses[0]?.price;
        salariesExpenses = salariesExpenses[0].price;
        const totalExpenses = rawMaterialExpenses + shopExpenses + salariesExpenses;
        return { rawMaterialExpenses, shopExpenses, salariesExpenses, totalExpenses };
    };

    const getProducts = async () => {
        const getOriginalProducts = async () => {
            const bills = await mongoose
                .model('Bill')
                .find({ createdAt: { $gte: startDate, $lte: endDate } })
                .lean();
            let dbOriginalProducts = [];

            bills.forEach((bill) => {
                dbOriginalProducts.push(
                    bill.products.map((p) => {
                        const amount = p.amount - p.amount * (bill.discountPercent / 100);
                        const costPricePerUnit = p.costPrice;
                        const costPrice = costPricePerUnit * p.qty;
                        return { ...p, amount, costPrice, costPricePerUnit };
                    })
                );
            });

            dbOriginalProducts = _.flattenDeep(dbOriginalProducts);

            const groupedOriginalProducts = [];
            for (const originalProduct of dbOriginalProducts) {
                const productIndex = groupedOriginalProducts.findIndex(
                    (p) => p._id.toString() === originalProduct._id.toString()
                );
                if (productIndex !== -1) {
                    const existingProduct = groupedOriginalProducts[productIndex];
                    existingProduct.qty += originalProduct.qty;
                    existingProduct.amount += originalProduct.amount;
                    existingProduct.costPrice += originalProduct.costPricePerUnit * originalProduct.qty;
                } else {
                    groupedOriginalProducts.push(originalProduct);
                }
            }
            return groupedOriginalProducts;
        };

        const getRefundProducts = async () => {
            const refundBills = await mongoose
                .model('RefundBill')
                .find({ createdAt: { $gte: startDate, $lte: endDate } })
                .lean();
            let dbRefundProducts = [];

            refundBills.forEach((refundBill) => {
                dbRefundProducts.push(
                    refundBill.products.map((p) => {
                        const costPricePerUnit = p.costPrice;
                        const costPrice = costPricePerUnit * p.qty;
                        return { ...p, costPrice, costPricePerUnit };
                    })
                );
            });

            dbRefundProducts = _.flattenDeep(dbRefundProducts);
            const groupedRefundProducts = [];

            for (const refundProduct of dbRefundProducts) {
                const productIndex = groupedRefundProducts.findIndex(
                    (p) => p._id.toString() === refundProduct._id.toString()
                );

                if (productIndex !== -1) {
                    const existingProduct = groupedRefundProducts[productIndex];
                    existingProduct.qty += refundProduct.qty;
                    existingProduct.amount += refundProduct.amount;
                    existingProduct.costPrice += refundProduct.costPricePerUnit * refundProduct.qty;
                } else {
                    groupedRefundProducts.push(refundProduct);
                }
            }
            return groupedRefundProducts;
        };

        const deductRefunds = (o, refunds) => {
            const originals = [...o];

            refunds.forEach((refundProduct) => {
                const originalProductIndex = originals.findIndex(
                    (e) => e._id.toString() === refundProduct._id.toString()
                );

                if (originalProductIndex > -1) {
                    originals[originalProductIndex].qty -= refundProduct.qty;
                    originals[originalProductIndex].amount -= refundProduct.amount;
                    originals[originalProductIndex].costPrice -= refundProduct.costPrice;
                }
            });

            return originals;
        };

        const [originalProducts, refundProducts] = await Promise.all([getOriginalProducts(), getRefundProducts()]);

        const deductedProducts = deductRefunds(originalProducts, refundProducts);

        return deductedProducts;
    };

    const getPrices = async (distinctProducts) => {
        let totalSellPrice = 0;
        let totalCostPrice = 0;
        distinctProducts.forEach((p) => {
            totalSellPrice += p.amount;
            totalCostPrice += p.costPrice;
        });
        return { totalSellPrice, totalCostPrice };
    };

    const getEarningValues = async (totalSalePrice, totalExpenses, totalCostPrice) => ({
        totalEarningVal1: totalSalePrice - totalExpenses,
        totalEarningVal2: totalSalePrice - totalCostPrice,
    });

    const [expenses, products] = await Promise.all([getExpenses(), getProducts()]);
    const [prices] = await Promise.all([getPrices(products)]);
    const earningValues = await getEarningValues(prices.totalSellPrice, expenses.totalExpenses, prices.totalCostPrice);
    res.status(200).send({ expenses, totalSales: products, prices, earningValues });
});
