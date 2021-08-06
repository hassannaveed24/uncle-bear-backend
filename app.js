const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

const Database = require('./utils/db');
const AppError = require('./utils/AppError');

const tilesRoute = require('./routes/products.route');
const normalCustomersRoute = require('./routes/normalCustomers.route');
const vipCustomersRoute = require('./routes/vipCustomers.route');
const employeesRoute = require('./routes/employees.route');
const suppliersRoute = require('./routes/suppliers.route');
const typesRoute = require('./routes/types.route');
const unitsRoute = require('./routes/units.route');
const inventoriesRoute = require('./routes/inventories.route');
const salesRoute = require('./routes/sales.route');
const expensesRoute = require('./routes/expenses.route');

const authRoute = require('./routes/auth.route');
const { errorController } = require('./controllers/errors.controller');

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

    app.use('/products', tilesRoute);
    app.use('/normal-customers', normalCustomersRoute);
    app.use('/vip-customers', vipCustomersRoute);
    app.use('/employees', employeesRoute);
    app.use('/suppliers', suppliersRoute);
    app.use('/types', typesRoute);
    app.use('/units', unitsRoute);
    app.use('/inventories', inventoriesRoute);
    // app.use('/sales', salesRoute);
    app.use('/expenses', expensesRoute);
    // app.use('/categories', protect, categoriesRoute);
    // app.use('/orders', protect, ordersRoute);
    app.use('/auth', authRoute);

    app.use('*', (req, res, next) => next(new AppError(`Cannot find ${req.originalUrl} on the server!`, 404)));

    app.use(errorController);
});
