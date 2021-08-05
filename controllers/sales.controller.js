const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/sales.model');
const { Model: Inventory, convertUnitsOfInventory } = require('../models/inventories.model');
const Customer = require('../models/customers.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const Type = require('../models/types.model');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort } = req.query;

    const results = await Model.paginate(
        {},
        {
            projection: { __v: 0 },
            populate: { path: 'customer', select: '-__v' },
            lean: true,
            page,
            limit,
            sort,
        }
    );

    res.status(200).json(
        _.pick(results, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.pay = catchAsync(async function (req, res, next) {
    // const { id, amount } = req.params;
    const amount = parseInt(req.params.amount);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id', 400));

    const sale = await Model.findById(id);

    if (!sale) return next(new AppError('Inventory does not exist', 404));

    const { sourcePrice, paid, isRemaining } = sale;

    if (!isRemaining) return next(new AppError('Khaata is already cleared', 400));

    if (amount > sourcePrice - paid) return next(new AppError('You are paying amount in extra', 400));

    sale.paid += amount;

    if (sale.paid >= sourcePrice) sale.isRemaining = false;

    await sale.save();

    res.status(200).send();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    // pick only wanted fields from body
    const body = _.pick(req.body, ['customer', 'retailPrice', 'inventory', 'quantity', 'paid', 'comments']);

    // if required fields are left out
    if (Object.keys(body).length < 5) return next(new AppError('Please enter a valid inventory', 400));

    // if customer field is not a valid mongoose ID
    if (!mongoose.isValidObjectId(body.customer)) return next(new AppError('Please enter a valid customer id', 400));

    // if customer does not exist
    const customer = await Customer.findById(body.customer).lean();

    if (!customer) return next(new AppError('Customer does not exist', 404));

    // if inventory field is not a valid mongoose ID
    if (!mongoose.isValidObjectId(body.inventory)) return next(new AppError('Please enter a valid inventory id', 400));

    // if inventory does not exist
    const inventory = await Inventory.findById(body.inventory, { __v: 0 }).lean();

    if (!inventory) return next(new AppError('Inventory does not exist', 400));

    if (body.retailPrice < inventory.sourcePrice) return next(new AppError('Cannot sell in loss', 400));

    // if we have enough inventory
    if (inventory.quantity < body.quantity) return next(new AppError('Insufficient inventory', 404));

    let updateInventory = Inventory.findByIdAndUpdate(body.inventory, {
        quantity: inventory.quantity - body.quantity,
    });

    const inventoryDepleted = inventory.quantity === body.quantity;

    // update the quantity of inventory, else remove it entirely
    if (inventoryDepleted) updateInventory = Inventory.findByIdAndDelete(body.inventory);

    body.isRemaining = body.paid < body.retailPrice;

    body.inventory = {
        _id: inventory._id,
        inventoryExists: !inventoryDepleted,
        type: inventory.product.type.title,
        title: inventory.product.title,
        sourcePrice: inventory.sourcePrice,
    };

    // add sale and update inventory concurrently
    await Promise.all([Model.create(body), updateInventory]);

    res.status(200).send();
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    // pick only wanted fields from body
    const docs = req.body.map((b) =>
        _.pick(b, ['customer', 'retailPrice', 'inventory', 'quantity', 'paid', 'comments'])
    );

    // if required fields are left out
    if (docs.every((d) => Object.keys(d).length < 5)) return next(new AppError('Please enter a valid inventory', 400));

    // if customer field is not a valid mongoose ID
    if (!docs.every((d) => mongoose.isValidObjectId(d.customer)))
        return next(new AppError('Please enter a valid customer id', 400));

    // get all customers
    const customerIds = [...new Set(docs.map((d) => d.customer))].map((c) => mongoose.Types.ObjectId(c));
    const customers = await Customer.find(
        { _id: { $in: customerIds } },
        { __v: 0, name: 0, phone: 0, createdAt: 0 }
    ).lean();

    // if even one customer does not exist
    if (customers.length !== customerIds.length) return next(new AppError('Customer(s) does not exist', 404));

    // if inventory field is not a valid mongoose ID
    if (!docs.every((d) => mongoose.isValidObjectId(d.inventory)))
        return next(new AppError('Please enter a valid inventory id', 400));

    // get all inventory
    const uniqueInventoryIds = [...new Set(docs.map((d) => d.inventory))];
    const inventoryIds = uniqueInventoryIds.map((c) => mongoose.Types.ObjectId(c));

    const inventories = await Inventory.find({ _id: { $in: inventoryIds } }, { __v: 0 })
        .populate({ path: 'supplier', select: '-__v' })
        .lean();

    inventories.forEach((i, index) => (docs[index] = convertUnitsOfInventory(i)));

    // even if one inventory does not exist
    // console.log({ inventories, inventoryIds });
    if (inventories.length !== inventoryIds.length) return next(new AppError('Inventory(s) does not exist', 404));

    for (const d of docs) {
        const inventory = inventories.find((i) => i._id.toString() === d.inventory);
        if (d.retailPrice < inventory.sourcePrice) return next(new AppError('Cannot sell in loss', 400));
    }

    // if we have enough inventory

    // group individual inventory ids
    // group docs quantities by group inventory ids
    const quantities = [];
    for (const i of inventories) {
        const salesOfSameInventory = docs.filter((d) => i._id.toString() === d.inventory);
        const totalQuantity = salesOfSameInventory.map((s) => s.quantity).reduce((a, b) => a + b);
        quantities.push(totalQuantity);
    }
    // calculate if quantities are greater than or equal to inventory ids quantities and store the errors
    const insufficientInventories = [];
    const isSufficientInventory = inventories.every((i, index) => {
        const isSufficient = i.quantity.single >= quantities[index];
        if (!isSufficient) insufficientInventories.push(`Insufficient ${i.product.title} Inventory`);
        return isSufficient;
    });

    if (!isSufficientInventory) return next(new AppError(insufficientInventories, 404));

    const inventoryQuantities = inventories.map((i) => i.quantity.single);

    // update quantities in array
    inventoryQuantities.forEach((i, index) => (inventoryQuantities[index] -= quantities[index]));

    // store all promises for concurrent execution
    const inventoryPromises = [];
    inventoryQuantities.forEach((q, index) => {
        const inventoryId = inventories[index]._id;
        let promise = Inventory.findByIdAndUpdate(inventoryId, {
            quantity: q,
        });

        if (q <= 0) promise = Inventory.findByIdAndDelete(inventoryId);

        inventoryPromises.push(promise);
    });

    // calculate isRemaining and store inventory with formatted units in DB
    for (const d of docs) {
        d.isRemaining = d.paid < d.retailPrice;
        const inventoryIndex = inventories.map((i) => i._id.toString()).indexOf(d.inventory);

        if (inventoryIndex === -1) return next(new AppError('Invalid inventory in latter part', 500));

        const inventory = inventories[inventoryIndex];

        const inventoryDepleted = inventoryQuantities[inventoryIndex] === 0;

        console.log(inventory.product.type);

        const type = await Type.findById(inventory.product.type, { __v: 0, _id: 0 }).lean();

        d.inventory = {
            _id: inventory._id,
            inventoryExists: !inventoryDepleted,
            type: type.title,
            title: inventory.product.title,
        };
        // d.inventory = _.pick(inventory, ['_id', 'quantity', 'isRemaining']);
    }

    // console.log()

    await Promise.all([Model.create(docs), ...inventoryPromises]);

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
