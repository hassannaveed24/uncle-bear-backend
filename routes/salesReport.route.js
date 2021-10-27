const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const { getAll } = require('../controllers/salesReport.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/', restrictToShop, getAll);

module.exports = router;
