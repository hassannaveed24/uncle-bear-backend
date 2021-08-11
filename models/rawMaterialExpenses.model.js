const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    createdAt: { type: Date, required: true, default: Date.now() },
    product_bought: {
        type: String,
        required: [true, 'Please enter name for product bought'],
        minlength: [4, 'Please enter a bare minimum of 4 characters in product bought'],
        maxlength: [255, 'Only 255 characters are allowed in product bought'],
    },
    price: {
        type: Number,
        required: [true, 'Please enter price'],
    },
    detail: {
        type: String,
        maxlength: [255, 'Only 255 characters are allowed in product bought'],
    },
    qty: {
        type: Number,
        required: [true, 'Please enter quantity'],
    },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('rawMaterialExpenses', schema);

module.exports = Model;
