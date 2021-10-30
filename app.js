const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

const Database = require('./utils/db');
const AppError = require('./utils/AppError');

const tilesRoute = require('./routes/products.route');
const normalCustomersRoute = require('./routes/normalCustomers.route');
const vipCustomersRoute = require('./routes/vipCustomers.route');
const shopsRoute = require('./routes/shops.route');
const productGroupsRoute = require('./routes/productGroups.route');
const productsRoute = require('./routes/products.route');
const rawMaterialExpensesRoute = require('./routes/rawMaterialExpenses.route');
const shopExpensesRoute = require('./routes/shopExpenses.route');
const salariesExpensesRoute = require('./routes/salariesExpenses.route');
const employeesRoute = require('./routes/employees.route');
const suppliersRoute = require('./routes/suppliers.route');
const typesRoute = require('./routes/types.route');
const unitsRoute = require('./routes/units.route');
const inventoriesRoute = require('./routes/inventories.route');
const billsRoute = require('./routes/bills.route');
const salesReportRoute = require('./routes/salesReport.route');
const salesRoute = require('./routes/sales.route');

const authRoute = require('./routes/auth.route');
const { errorController } = require('./controllers/errors.controller');
const { restrictToShop } = require('./middlewares/createdShop.middleware');

const app = express();

dotenv.config({ path: path.resolve(process.cwd(), `.${process.env.NODE_ENV}.env`) });

const port = process.env.PORT || 5500;

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    new Database()
        .connect()
        .then(() => console.log('Connected to DB'))
        .catch((err) => console.log(err.message));

    app.use(express.json());

    app.use(cors());

    app.get('/', (req, res) => {
        res.status(200).send(`Server running at PORT ${port}`);
    });

    // app.use('/products', tilesRoute);
    app.use('/normal-customers', normalCustomersRoute);
    app.use('/vip-customers', vipCustomersRoute);
    app.use('/shops', shopsRoute);
    app.use('/product-groups', productGroupsRoute);
    app.use('/products', productsRoute);
    app.use('/raw-material-expenses', rawMaterialExpensesRoute);
    app.use('/shop-expenses', shopExpensesRoute);
    app.use('/salaries', salariesExpensesRoute);
    app.use('/employees', employeesRoute);
    app.use('/inventories', inventoriesRoute);
    app.use('/bills', billsRoute);
    app.use('/sales-report', salesReportRoute);
    // app.use('/suppliers', suppliersRoute);
    // app.use('/types', typesRoute);
    // app.use('/units', unitsRoute);
    // // app.use('/sales', salesRoute);

    // // app.use('/categories', protect, categoriesRoute);
    // app.use('/auth', authRoute);

    app.use('*', (req, res, next) => next(new AppError(`Cannot find ${req.originalUrl} on the server!`, 404)));

    app.use(errorController);
});
