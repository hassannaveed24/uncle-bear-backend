const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    customer: { type: mongoose.Types.ObjectId, ref: 'Customer', required: [true, 'Please enter a customer'] },
    inventory: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter an inventory'] },
    retailPrice: {
        type: Number,
        required: [true, 'Please enter retail price'],
    },
    paid: {
        type: Number,
        required: [true, 'Please enter paid amount'],
        min: [1, 'Paid amount must be positive'],
        validate: {
            validator: function (p) {
                return p <= this.retailPrice;
            },
            message: 'Paid amount must be less than or equal to the retail price',
        },
    },
    isRemaining: { type: Boolean, required: [true, 'Please enter isRemaining'] },
    quantity: {
        type: Number,
        required: [true, 'Please enter a quantity'],
        min: [1, 'Quantity must be greater than 0'],
    },
    comments: {
        type: String,
        maxlength: [255, 'Comments are no more than 255 characters'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);

const Model = mongoose.model('Sale', schema);

module.exports = Model;
