const router = require('express').Router();

const autoParams = require('../utils/autoParams');
const { getAll, addOne, remove, pay, addMany } = require('../controllers/inventories.controller');

router.get('/', autoParams, getAll);
router.route('/').post(addOne);
router.route('/many').post(addMany);
router.route('/pay/id/:id/amount/:amount').post(pay);
router.route('/id/:id').delete(remove);

module.exports = router;
