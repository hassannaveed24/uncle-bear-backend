const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const {
    getAll,
    addOne,
    remove,
    edit,
    pay,
    addMany,
    getTransactions,
} = require('../controllers/inventories.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/', getAll);
router.get('/transactions/:type', autoParams, restrictToShop, getTransactions);
router.post('/', restrictToShop, addOne);
router.patch('/id/:id', restrictToShop, edit);
router.route('/id/:id').delete(remove);

module.exports = router;
