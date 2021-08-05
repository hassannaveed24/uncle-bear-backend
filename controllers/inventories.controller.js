const mongoose = require('mongoose');
const _ = require('lodash');
const { Model, convertUnitsOfInventory } = require('../models/inventories.model');
const Product = require('../models/products.model');
const Unit = require('../models/units.model');
const Supplier = require('../models/suppliers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const results = await Model.paginate(
        {},
        { projection: { __v: 0 }, populate: { path: 'supplier', select: '-__v' }, lean: true, page, limit, sort }
    );

    // eslint-disable-next-line no-param-reassign
    results.docs.forEach((d) => (d = convertUnitsOfInventory(d)));

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const body = _.pick(req.body, ['supplier', 'sourcePrice', 'product', 'quantity', 'units', 'paid']);

    if (Object.keys(body).length !== 6) return next(new AppError('Please enter a valid inventory', 400));

    if (!mongoose.isValidObjectId(body.supplier)) return next(new AppError('Please enter a valid supplier id', 400));

    const supplier = await Supplier.findById(body.supplier).lean();

    if (!supplier) return next(new AppError('Supplier does not exist', 404));

    if (!mongoose.isValidObjectId(body.product)) return next(new AppError('Please enter a valid product id', 400));

    const product = await Product.findById(body.product, { __v: 0 })
        .populate({
            path: 'type',
            select: '_id',
        })
        .lean();

    if (!product) return next(new AppError('Product does not exist', 400));

    body.units = [...new Set(body.units)];
    const unitIds = [];

    for (const u of body.units) {
        if (!mongoose.isValidObjectId(u)) return next(new AppError('Invalid unit id(s)', 400));
        unitIds.push(mongoose.Types.ObjectId(u));
    }

    const units = await Unit.find({ _id: { $in: unitIds } }, { __v: 0 })
        .populate({ path: 'type', select: '-__v' })
        .lean();

    if (units.length !== unitIds.length) return next(new AppError('Invalid units', 400));

    const areValidUnits = units.every((u) => u.type._id.toString() === product.type._id.toString());
    if (!areValidUnits) return next(new AppError('Please enter units that are suitable for the product', 400));

    body.units = units.map((u) => ({ ..._.omit(u, ['type', 'createdAt']), unitExists: true }));

    body.isRemaining = body.paid !== body.sourcePrice;

    body.product = { ...product, productExists: true };

    await Model.create(body);
    res.status(200).send();
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
        d.units = units.map((u) => ({ ..._.omit(u, ['type', 'createdAt']), unitExists: true }));
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

module.exports.remove = catchAsync(async function (req, res, next) {
    let ids = req.params.id.split(',');

    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id(s)', 400));
    }

    ids = ids.map((id) => mongoose.Types.ObjectId(id));

    await Model.deleteMany({ _id: { $in: ids } });

    res.status(200).json();
});
