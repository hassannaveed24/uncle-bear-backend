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
        type: Number,
        required: [true, 'Please enter a phone number'],
        validate: {
            message: 'Please enter a valid phone number of 12 digits',
            validator: function (p) {
                const { length } = p.toString();
                return length === 12;
            },
        },
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
