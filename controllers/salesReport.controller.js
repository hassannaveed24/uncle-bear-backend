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
    let [rawMaterialExpenses, shopExpenses, salariesExpenses, bills] = await Promise.all([
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
        await mongoose.model('Bill').find({ createdAt: { $gte: startDate, $lte: endDate } }),
    ]);
    // let sales =[ {
    //     product,
    //     group,
    //     qty,
    //     sellPrice,
    //     costPrice
    // }]

    if (bills) {
        bills.forEach((bill) => {
            bill.products.forEach((product) => {
                console.log(product.product.name);
            });
        });
        return res.send(bills);
    }

    rawMaterialExpenses = rawMaterialExpenses[0].price;
    shopExpenses = shopExpenses[0].price;
    salariesExpenses = salariesExpenses[0].price;
    const totalExpenses = rawMaterialExpenses + shopExpenses + salariesExpenses;

    res.status(200).send({ expenses: { rawMaterialExpenses, shopExpenses, salariesExpenses, totalExpenses } });
});
