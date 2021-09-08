const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    item: {
        type: String,
        required: [true, 'Please enter a title'],
        minlength: [3, 'Please enter a bare minimum of 3 characters in item'],
        maxlength: [35, 'Only 35 characters are allowed in title'],
    },
    quantity: { type: Number, required: [true, 'Please enter a quantity'] },
    description: {
        type: String,
        minlength: [3, 'Please enter a bare minimum of 3 characters in description'],
        maxlength: [255, 'Only 255 characters are allowed in description'],
    },
    createdAt: { type: Date, required: true, default: Date.now() },
    createdShop: {
        type: mongoose.Types.ObjectId,
        ref: 'Shop',
        required: [true, 'Please enter shop'],
    },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Inventory', schema);

module.exports = Model;
