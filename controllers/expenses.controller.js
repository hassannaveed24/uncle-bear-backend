const mongoose = require('mongoose');
const _ = require('lodash');
const { Model, Type } = require('../models/expenses.model');
const Employee = require('../models/employees.model');
const { catchAsync } = require('./errors.controller');
const AppError = require('../utils/AppError');
const Sale = require('../models/sales.model');
const { Model: Inventory } = require('../models/inventories.model');

module.exports.getAll = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const docs = await Model.paginate(
        {
            $or: [{ title: { $regex: `${search}`, $options: 'i' } }],
        },
        { projection: { __v: 0 }, populate: { path: 'type', select: '-__v' }, lean: true, page, limit, sort }
    );

    const employeeIds = [];

    docs.docs.forEach((d) => {
        if (d.employee) employeeIds.push(d.employee._id);
    });

    const uniqueEmployeeIds = [...new Set(employeeIds)].map((id) => mongoose.Types.ObjectId(id));

    const employees = await Employee.find({ _id: { $in: uniqueEmployeeIds } }, { __v: 0 }).lean();

    const existingEmployeeIds = employees.map((e) => e._id.toString());

    docs.docs.forEach((d) => {
        if (d.employee && d.employee._id.toString()) {
            if (existingEmployeeIds.includes(d.employee._id.toString())) d.employeeExists = true;
        }
    });

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getAllSalaries = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;
    const salaryType = await Type.findOne({ title: 'salary' }).lean();

    const docs = await Model.paginate(
        { type: salaryType._id },
        { projection: { __v: 0 }, populate: { path: 'type', select: '-__v' }, lean: true, page, limit }
    );

    const employeeIds = docs.docs.map((d) => d.employee._id);

    const uniqueEmployeeIds = [...new Set(employeeIds)].map((id) => mongoose.Types.ObjectId(id));

    const employees = await Employee.find({ _id: { $in: uniqueEmployeeIds } }, { __v: 0 }).lean();

    const existingEmployeeIds = employees.map((e) => e._id.toString());

    docs.docs.forEach((d) => {
        if (existingEmployeeIds.includes(d.employee._id.toString())) d.employeeExists = true;
    });

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getAllTypes = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const docs = await Type.paginate({}, { projection: { __v: 0 }, lean: true, page, limit });

    res.status(200).json(
        _.pick(docs, ['docs', 'totalDocs', 'hasPrevPage', 'hasNextPage', 'totalPages', 'pagingCounter'])
    );
});

module.exports.getKhaata = catchAsync(async function (req, res, next) {
    const { page, limit, sort, search } = req.query;

    const salesPromise = Sale.find({ isRemaining: true }, { __v: 0, isRemaining: 0 })
        .populate({ path: 'customer', select: '_id name' })
        .lean();

    const inventoriesPromise = Inventory.find({ isRemaining: true }, { __v: 0, isRemaining: 0 })
        .populate({ path: 'supplier', select: '_id name' })
        .lean();

    const [sales, inventories] = await Promise.all([salesPromise, inventoriesPromise]);

    const data = [...sales, ...inventories];

    const totalDocs = data.length;
    const offset = page * limit;

    const docs = data.slice(0, limit);
    const totalPages = Math.ceil(totalDocs / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = totalDocs > offset;
    const pagingCounter = (page - 1) * offset + 1;

    res.status(200).json({ docs, totalDocs, totalPages, hasPrevPage, hasNextPage, pagingCounter });
});

module.exports.addMany = catchAsync(async function (req, res, next) {
    // pick only wanted fields from body
    const docs = req.body.map((b) => _.pick(b, ['title', 'amount', 'type', 'comments', 'employee']));

    // if required fields are left out
    if (
        docs.some((d) => {
            let validExpenseLength = 3;
            if (d.employee) validExpenseLength = 2;
            return Object.keys(d).length > validExpenseLength;
        })
    )
        return next(new AppError('Please enter valid expenses', 400));

    if (docs.some((d) => !mongoose.isValidObjectId(d.type)))
        return next(new AppError('Please enter valid type id(s)', 400));

    if (
        docs.some((d) => {
            if (d.employee) return false;
            return !mongoose.isValidObjectId(d.employee);
        })
    )
        return next(new AppError('Please enter valid employee id(s)', 400));

    const typeIds = docs.map((d) => d.type);
    const uniqueTypeIds = [...new Set(typeIds)].map((id) => mongoose.Types.ObjectId(id));

    const types = await Type.find(
        { _id: { $in: uniqueTypeIds } },
        { __v: 0, _id: 0, amount: 0, type: 0, comments: 0 }
    ).lean();

    if (uniqueTypeIds.length !== types.length) return next(new AppError('Type(s) does not exist', 404));

    const employeeIds = docs.map((d) => d.employee);
    const uniqueEmployeeIds = [...new Set(employeeIds)].map((id) => mongoose.Types.ObjectId(id));

    const employees = await Employee.find(
        { _id: { $in: uniqueEmployeeIds } },
        {
            __v: 0,
            createdAt: 0,
            phone: 0,
            cnic: 0,
            address: 0,
            salary: 0,
        }
    ).lean();

    if (uniqueEmployeeIds.length !== employees.length) return next(new AppError('Employee(s) does not exist', 404));

    docs.forEach((d) => {
        if (d.employee) {
            const employee = employees.find((e) => e._id.toString() === d.employee);
            d.amount = employee.salary;
            d.employee = employee;
            d.title = `Salary - ${employee.name}`;
        }
    });

    await Model.create(docs);

    res.status(200).json();
});

module.exports.addOne = catchAsync(async function (req, res, next) {
    const doc = _.pick(req.body, ['title', 'amount', 'type', 'comments', 'employee']);

    let validExpenseLength = 3;

    if (doc.employee) validExpenseLength = 2;

    if (Object.keys(doc).length < validExpenseLength) return next(new AppError('Please enter valid expense', 400));

    if (!mongoose.isValidObjectId(doc.type)) return next(new AppError('Please enter valid type id', 400));

    const type = await Type.findById(doc.type).lean();

    if (!type) return next(new AppError('Type does not exist', 404));

    if (doc.employee) {
        if (type.title !== 'salary') return next(new AppError('Salary type must be attached with salary', 400));

        if (!mongoose.isValidObjectId(doc.employee)) return next(new AppError('Please enter valid employee id', 400));

        const employee = await Employee.findById(doc.employee, {
            __v: 0,
            createdAt: 0,
            phone: 0,
            cnic: 0,
            address: 0,
        }).lean();

        if (!employee) return next(new AppError('Employee does not exist', 404));

        doc.amount = employee.salary;
        doc.employee = employee;
        doc.title = `Salary - ${employee.name}`;
    }

    await Model.create(doc);

    res.status(200).json();
});

module.exports.addOneType = catchAsync(async function (req, res, next) {
    const doc = _.pick(req.body, ['title']);

    if (Object.keys(doc).length !== 1) return next(new AppError('Please enter valid expense type', 400));

    await Type.create(doc);

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

module.exports.removeTypes = catchAsync(async function (req, res, next) {
    const ids = req.params.id.split(',');

    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) return next(new AppError('Please enter valid id(s)', 400));
    }

    const typeIds = [...new Set(ids)].map((id) => mongoose.Types.ObjectId(id));

    const expenses = await Model.find({ type: { $in: typeIds } });
    const expenseIds = [...new Set(expenses.map((e) => e._id))];

    await Promise.all([Model.deleteMany({ _id: { $in: expenseIds } }), Type.deleteMany({ _id: { $in: typeIds } })]);

    res.status(200).json();
});
