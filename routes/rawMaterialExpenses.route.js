const router = require('express').Router();

const { getAll, addOne, addMany, edit, remove } = require('../controllers/rawMaterialExpenses.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.route('/').get(getAll);
router.post('/', restrictToShop, addOne);
router.patch('/id/:id', restrictToShop, edit);
router.route('/id/:id').delete(remove);

module.exports = router;
