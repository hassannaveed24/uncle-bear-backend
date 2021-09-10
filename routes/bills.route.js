const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const { getAll, addOne, remove, edit, pay, addMany, getTransactions } = require('../controllers/bills.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/', autoParams, getAll);
router.get('/transactions', autoParams, getTransactions);
router.post('/', restrictToShop, addOne);
router.patch('/id/:id', restrictToShop, edit);
router.route('/id/:id').delete(remove);

module.exports = router;
