const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    registeredGroupId: {
        type: mongoose.Types.ObjectId,
        ref: 'ProductGroup',
        required: [true, 'Product group is required'],
    },
    name: {
        type: String,
        required: [true, 'Please enter product name'],
        minlength: [4, 'Please enter a bare minimum of 4 characters in title'],
        maxlength: [255, 'Only 255 characters are allowed in title'],
    },
    salePrice: {
        type: Number,
        required: [true, 'Please enter sale price'],
    },
    costPrice: {
        type: Number,
        required: [true, 'Please enter cost price'],
    },
    description: {
        type: String,
    },

    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
});
schema.plugin(mongoosePagiante);
const Model = mongoose.model('Product', schema);

module.exports = Model;
