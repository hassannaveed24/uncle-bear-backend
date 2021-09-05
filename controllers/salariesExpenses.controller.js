const mongoose = require('mongoose');
const _ = require('lodash');
const { ObjectId } = require('mongoose').Types;
const Model = require('../models/salariesExpenses.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { employeeId } = req.query;

    const result = await Model.find({ employeeId: ObjectId(employeeId) });

    res.status(200).send(result);
});

// module.exports.addMany = catchAsync(async function (req, res, next) {
//     const docs = req.body;

//     if (!docs || !docs.length) return next(new AppError('Please enter valid customers', 400));

//     await Model.insertMany(docs);

//     res.status(200).json();
// });

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['employeeId', 'description', 'createdShop', 'amount']);
    await Model.create(newDoc);
    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['employeeId', 'description', 'createdShop', 'amount']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid expense', 400));

    await Model.updateOne({ _id: id }, newDoc, { runValidators: true });

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
