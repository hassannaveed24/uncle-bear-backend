const router = require('express').Router();

const { getAll, addOne, addMany, edit, remove } = require('../controllers/normalCustomers.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.route('/').get(getAll);
router.post('/', restrictToShop, addOne);
// router.route('/many').post(addMany);
router.route('/id/:id').patch(edit);
router.route('/id/:id').delete(remove);

module.exports = router;
