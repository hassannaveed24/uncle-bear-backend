const router = require('express').Router();

const {
    getAll,
    getSalariesbyEmployeee,
    addOne,
    addMany,
    edit,
    remove,
} = require('../controllers/salariesExpenses.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/employees', restrictToShop, getSalariesbyEmployeee);
router.get('/', restrictToShop, getAll);
router.post('/', restrictToShop, addOne);
router.patch('/id/:id', restrictToShop, edit);
router.route('/id/:id').delete(remove);

module.exports = router;
