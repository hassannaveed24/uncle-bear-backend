const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter a name'],
        minlength: [4, 'Please enter a bare minimum of 4 characters in name'],
        maxlength: [255, 'Only 255 characters are allowed in name'],
    },
    phone: {
        type: String,
        minlength: [3, 'Please enter at least 3 characters as phone number'],
        maxlength: [20, 'Maximum 20 characters are allowed in name'],
    },
    balance: {
        type: Number,
        required: [true, 'Please Enter balance'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
    createdShop: {
        type: String,
        required: [true, 'Please enter shop address'],
        maxlength: [255, 'Only 255 characters are allowed in shop'],
    },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('vipCustomer', schema);

module.exports = Model;
