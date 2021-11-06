/* eslint-disable no-prototype-builtins */
const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/bills.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');
const Supplier = require('../models/suppliers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const RefundBill = require('../models/refundBills.model');
const generateBillId = require('../utils/generateBillId');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, startDate, endDate } = req.query;

    const bills = await mongoose.model('Bill').paginate(
        { createdAt: { $gte: startDate, $lte: endDate } },
        {
            projection: { __v: 0 },
            lean: true,
            populate: { path: 'createdShop', select: '_id address' },
            page,
            limit,
            sort: { _id: -1 },
        }
    );

    console.log(bills);

    res.status(200).send(bills);
});

module.exports.getOne = catchAsync(async function (req, res, next) {
    const { id } = req.params;
    if (!id || id === 'null' || id === 'undefined') return next(new AppError('Please enter a bill id', 400));
    const bill = await Model.findOne({ billId: id });
    res.status(200).send(bill);
});

module.exports.getTransactions = catchAsync(async function (req, res, next) {
    const { page, limit, search } = req.query;

    const results = await Model.paginate(
        {
            $or: [
                { item: { $regex: `${search}`, $options: 'i' } },
                { description: { $regex: `${search}`, $options: 'i' } },
            ],
        },
        { projection: { __v: 0 }, lean: true, page, limit }
    );

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    let body = _.pick(req.body, ['type', 'products', 'discountPercent', 'customer']);
    switch (body.type) {
        case 'WALKIN':
            body = { ...body, customer: { name: body.type } };
            break;
        case 'NORMAL':
            body.customer = await mongoose.model('NormalCustomer').findById(body.customer, 'name phone').lean();
            break;
        default:
            break;
    }

    const productIds = body.products.map((product) => product.product);

    const products = await mongoose
        .model('Product')
        .find(
            {
                _id: {
                    $in: productIds,
                },
            },
            { _id: 1, name: 1, salePrice: 1, costPrice: 1 }
        )
        .populate({ path: 'registeredGroupId', select: 'name' })
        .lean();

    body.products.forEach((bodyProduct) => {
        bodyProduct.product = products.find((product) => product._id.toString() === bodyProduct.product.toString());
    });

    let subTotal = 0;
    body.products.forEach((product) => {
        const amount = product.salePrice * product.qty;
        product.amount = amount;
        subTotal += amount;
    });
    const discountAmount = Number(subTotal * body.discountPercent * 0.01);
    const total = Number(subTotal - discountAmount);

    const bill = await Model.create({
        ...body,
        total,
        subTotal,
        discountAmount,
        createdShop: res.locals.shop._id,
    });
    const generatedBillId = bill._id.toString();
    const billId = generateBillId(generatedBillId);
    await Model.findByIdAndUpdate(generatedBillId, { billId });
    res.status(200).send({ ...bill, billId });
});

module.exports.vipBill = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['type', 'products', 'discountPercent', 'customer', 'vipBalancePercent']);
    body.customer = await mongoose.model('VipCustomer').findById(body.customer, 'name phone balance');
    const productIds = body.products.map((product) => product.product);
    const products = await mongoose
        .model('Product')
        .find(
            {
                _id: {
                    $in: productIds,
                },
            },
            { _id: 1, name: 1, salePrice: 1, costPrice: 1 }
        )
        .populate({ path: 'registeredGroupId', select: 'name' })
        .lean();

    body.products.forEach((bodyProduct) => {
        bodyProduct.product = products.find((product) => product._id.toString() === bodyProduct.product.toString());
    });

    let subTotal = 0;
    body.products.forEach((product) => {
        const amount = product.salePrice * product.qty;
        product.amount = amount;
        subTotal += amount;
    });
    const discountAmount = Number(subTotal * body.discountPercent * 0.01);
    const total = Number(subTotal - discountAmount);
    const vipNeeded = Number(body.vipBalancePercent * 0.01 * total);
    const vipConsumed = vipNeeded <= body.customer.balance ? vipNeeded : body.customer.balance;
    const remainingPay = total - vipConsumed;
    body.customer.balance -= vipConsumed;
    await mongoose.model('VipCustomer').findByIdAndUpdate(body.customer._id, { balance: body.customer.balance });

    const bill = await Model.create({
        ...body,
        total,
        subTotal,
        discountAmount,
        vipConsumed,
        remainingPay,
        createdShop: res.locals.shop._id,
    });
    const generatedBillId = bill._id.toString();
    const billId = generateBillId(generatedBillId);
    await Model.findByIdAndUpdate(generatedBillId, { billId });
    res.status(200).send({ ...bill, billId });
});

module.exports.refundBill = catchAsync(async function (req, res, next) {
    // RECEIVE BILL ID FROM PARAMS
    const { id: billId } = req.params;

    if (!mongoose.isValidObjectId(billId)) return next(new AppError('Please enter a valid bill id', 400));

    // SAMPLE PAYLOAD
    // [
    //     {
    //         product: 'abc',
    //         qty: 2
    //     },
    //     {
    //         product: 'abc',
    //         qty: 2
    //     },
    // ]

    const body = [];

    for (const b of req.body) {
        const filteredB = _.pick(b, ['product', 'qty']);
        if (!filteredB.hasOwnProperty('product') || !filteredB.hasOwnProperty('qty')) {
            return next(new AppError('Invalid payload structure', 400));
        }

        body.push(filteredB);
    }

    // FETCH BILL AND VALIDATE
    const originalBill = await Model.findById(billId).lean();

    if (!originalBill) return next(new AppError('Bill does not exist', 400));

    // POPULATE ALL PRODUCT IDS COMING FROM PAYLOAD
    const productIds = body.map((b) => b.product); // ['abc', 'abc']
    const uniqueProductIds = [...new Set(productIds)]; // ['abc']

    if (uniqueProductIds.length < productIds.length) return next(new AppError('Duplicate products not allowed', 400));

    const products = originalBill.products
        .filter((p) => uniqueProductIds.includes(p._id.toString()))
        .map((p) => ({ ...p.product, qty: p.qty, amount: p.amount }));

    if (products.length < uniqueProductIds)
        return next(new AppError('Product(s) does not exist in the original bill', 404));

    body.forEach((b) => {
        const populatedProduct = products.find((p) => p._id.toString() === b.product);
        b.product = populatedProduct;
    });

    // CREATE A REFUND BILL

    const refundBill = {
        originalBill: originalBill._id,
        products: [],
        total: 0,
        createdShop: res.locals.shop._id,
        customer: originalBill.customer,
        discountPercent: originalBill.discountPercent,
    };

    // CHECK THE QUANTITY OF CORRESPONDING PRODUCTS

    for (const p of body) {
        if (p.qty > p.product.qty)
            return next(new AppError('Not enough product quantity(s) in the original bill', 400));

        const product = { ..._.omit(p.product, ['qty', 'amount']), qty: p.qty };

        const absoluteAmount = product.salePrice * p.qty;
        const discountedAmount = absoluteAmount - absoluteAmount * (refundBill.discountPercent / 100);

        product.amount = discountedAmount;

        refundBill.products.push(product);
    }

    // CALCULATE TOTAL

    const totals = [0, 0];

    refundBill.products.forEach((p) => totals.push(p.amount));

    refundBill.total = totals.reduce((a, b) => a + b);

    const createdBill = await RefundBill.create(refundBill);

    const generatedBillId = createdBill._id.toString();
    const createdBillId = generateBillId(generatedBillId);
    await Model.findByIdAndUpdate(generatedBillId, { billId: createdBillId });
    res.status(200).send({ ...createdBill, billId: createdBillId });

    // res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['item', 'quantity', 'description']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid transaction', 400));

    await Model.updateOne({ _id: id }, { ...newDoc, createdShop: res.locals.shop._id }, { runValidators: true });

    res.status(200).json();
});

module.exports.remove = catchAsync(async function (req, res, next) {
    let ids = req.params.id.split(',');

    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id(s)', 400));
    }

    ids = ids.map((id) => mongoose.Types.ObjectId(id));

    await Model.deleteMany({ _id: { $in: ids } });

    res.status(200).json();
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    // pick only wanted fields from body
    const docs = req.body.map((b) => _.pick(b, ['supplier', 'sourcePrice', 'product', 'quantity', 'units', 'paid']));

    // if required fields are left out
    if (docs.some((d) => Object.keys(d).length < 5))
        return next(new AppError('Please enter a valid inventory(s)', 400));

    // if supplier field is not a valid mongoose ID
    if (!docs.every((d) => mongoose.isValidObjectId(d.supplier)))
        return next(new AppError('Please enter a valid supplier id(s)', 400));

    // get all suppliers
    const supplierIds = [...new Set(docs.map((d) => d.supplier))].map((s) => mongoose.Types.ObjectId(s));
    const suppliers = await Supplier.find({ _id: { $in: supplierIds } }, { __v: 0, phone: 0, company: 0 }).lean();

    // if even one supplier does not exist
    if (suppliers.length !== supplierIds.length) return next(new AppError('Supplier(s) does not exist', 404));

    // if supplier field is not a valid mongoose ID
    if (!docs.every((d) => mongoose.isValidObjectId(d.product)))
        return next(new AppError('Please enter a valid product(s) id', 400));

    // get all products
    const productIds = [...new Set(docs.map((d) => d.product))].map((p) => mongoose.Types.ObjectId(p));
    const products = await Product.find({ _id: { $in: productIds } }, { __v: 0, modelNumber: 0 }).lean();

    // if even one product does not exist
    if (products.length !== productIds.length) return next(new AppError('Product(s) does not exist', 404));
    let uniqueUnitIds = [];

    docs.forEach((d) => {
        const uniqueUnits = [...new Set(d.units)];
        uniqueUnits.forEach((u) => {
            if (!mongoose.isValidObjectId(u)) return next(new AppError('Invalid unit id(s)', 400));
            uniqueUnitIds.push(u);
        });
    });

    uniqueUnitIds = [...new Set(uniqueUnitIds)].map((id) => mongoose.Types.ObjectId(id));

    const units = await Unit.find({ _id: { $in: uniqueUnitIds } }, { __v: 0 })
        .populate({ path: 'type', select: '-__v' })
        .lean();

    if (units.length !== uniqueUnitIds.length) return next(new AppError('Unit(s) does not exist', 400));

    const pIds = [...new Set(docs.map((d) => d.product))];

    const areValidUnits = units.every((u) =>
        pIds.every((pId) => {
            const c1 = u.type._id.toString();
            const c2 = products.find((p) => p._id.toString() === pId).type.toString();
            const condition = c1 === c2;
            return condition;
        })
    );
    if (!areValidUnits) return next(new AppError('Please enter units that are suitable for the product', 400));

    docs.forEach((d) => {
        d.units = units.map((u) => ({
            ..._.omit(u, ['type', 'createdAt']),
            unitExists: true,
        }));
        d.isRemaining = d.paid !== d.sourcePrice;
        const product = products.find((p) => p._id.toString() === d.product.toString());
        d.product = { ...product, productExists: true };
    });

    await Model.create(docs);
    res.status(200).send();
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const inventory = await Model.findById(id);

    if (!inventory) return next(new AppError('Inventory does not exist', 404));

    const { sourcePrice, paid, isRemaining } = inventory;

    if (!isRemaining) return next(new AppError('Khaata is already cleared', 400));

    if (amount > sourcePrice - paid) return next(new AppError('You are paying amount in extra', 400));

    inventory.paid += amount;

    if (inventory.paid >= sourcePrice) inventory.isRemaining = false;

    await inventory.save();

    res.status(200).send();
});
