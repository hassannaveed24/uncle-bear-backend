const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const { getSalesReport } = require('../controllers/audit.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/sales-report', autoParams, restrictToShop, getSalesReport);

module.exports = router;
