const router = require('express').Router();

const {
    getAll,
    getAllCSV,
    getSalariesbyEmployeee,
    getSalariesbyEmployeeeCSV,
    addOne,
    addMany,
    edit,
    remove,
} = require('../controllers/salariesExpenses.controller');
const { restrictToShop } = require('../middlewares/createdShop.middleware');

router.get('/employees', restrictToShop, getSalariesbyEmployeee);
router.get('/employees/get-csv', restrictToShop, getSalariesbyEmployeeeCSV);
router.get('/', restrictToShop, getAll);
router.get('/get-csv', restrictToShop, getAllCSV);
router.post('/', restrictToShop, addOne);
router.patch('/id/:id', restrictToShop, edit);
router.route('/id/:id').delete(remove);

module.exports = router;
