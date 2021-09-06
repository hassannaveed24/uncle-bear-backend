const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    quantity: { type: Number, required: [true, 'Please enter a quantity'], min: [0, 'Quantity must be positive'] },
    createdAt: { type: Date, required: true, default: Date.now() },
});

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Inventory', schema);

module.exports = Model;
