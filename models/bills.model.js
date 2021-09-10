const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');
const { productSchema } = require('./products.model');

const schema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['WALKIN', 'NORMAL', 'VIP', 'REFUND'],
        required: [true, 'Please enter type'],
    },
    products: {
        type: [
            {
                ...productSchema,
                qty: { type: Number, required: [true, 'Please enter quantity'] },
                amount: { type: Number, required: [true, 'Please enter amount'] },
            },
        ],
    },
    subTotal: {
        type: Number,
    },
    discount: {
        type: Number,
    },
    total: {
        type: Number,
    },
    createdAt: { type: Date, required: true, default: Date.now() },
    createdShop: {
        type: mongoose.Types.ObjectId,
        ref: 'Shop',
        required: [true, 'Please enter shop'],
    },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Bill', schema);

module.exports = Model;
