const mongoose = require('mongoose');
const _ = require('lodash');
const Model = require('../models/products.model');
const Type = require('../models/types.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const results = await Model.paginate(
        {
            $or: [{ title: { $regex: `${search}`, $options: 'i' } }],
        },
        {
            projection: { __v: 0 },
            populate: { path: 'type', select: '_id title' },
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

module.exports.addMany = catchAsync(async function (req, res, next) {
    const docs = req.body.map((b) => _.pick(b, ['title', 'modelNumber', 'type']));

    if (docs.some((d) => d.length < 3)) return next(new AppError('Please enter valid products', 400));

    const typeIds = [...new Set(docs.map((d) => d.type))].map((id) => mongoose.Types.ObjectId(id));

    const types = await Type.find({ _id: { $in: typeIds } }, { title: 0, createdAt: 0, __v: 0 }).lean();

    if (types.length !== typeIds.length) return next(new AppError('Type id(s) invalid', 400));

    await Model.insertMany(docs);

    res.status(200).json();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const newDoc = _.pick(req.body, ['title', 'modelNumber', 'type']);

    if (Object.keys(newDoc).length < 3) return next(new AppError('Please enter a valid product', 400));

    const type = await Type.findById(newDoc.type, { title: 0, createdAt: 0, __v: 0 }).lean();

    if (!type) return next(new AppError('Type does not exist', 404));

    await Model.create(newDoc);

    res.status(200).send();
});

module.exports.edit = catchAsync(async function (req, res, next) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter a valid id', 400));

    const newDoc = _.pick(req.body, ['title', 'modelNumber', 'type']);

    if (!Object.keys(newDoc).length) return next(new AppError('Please enter a valid product', 400));

    const type = await Type.findById(newDoc.type).lean();

    if (!type) return next('Type does not exist', 404);

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
