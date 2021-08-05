const mongoose = require('mongoose');
const mongoosePagiante = require('mongoose-paginate-v2');

const schema = new mongoose.Schema({
    supplier: { type: mongoose.Types.ObjectId, ref: 'Supplier', required: [true, 'Please enter a supplier'] },
    product: { type: mongoose.SchemaTypes.Mixed, required: [true, 'Please enter a product'] },
    sourcePrice: {
        type: Number,
        required: [true, 'Please enter source price'],
        min: [1, 'Source price must be positive'],
    },
    paid: {
        type: Number,
        required: [true, 'Please enter paid price'],
        min: [1, 'Paid price must be positive'],
        validate: {
            validator: function (p) {
                return p <= this.sourcePrice;
            },
            message: 'Paid price must be less than or equal to the source price',
        },
    },
    isRemaining: { type: Boolean, required: [true, 'Please enter isRemaining'] },
    quantity: { type: Number, required: [true, 'Please enter a quantity'], min: [0, 'Quantity must be positive'] },
    units: {},
    comments: {
        type: String,
        maxlength: [255, 'Comments are no more than 255 characters'],
    },
    // createdBy: { type: mongoose.ObjectId, ref: 'User', select: false },
    createdAt: { type: Date, required: true, default: Date.now() },
    khaataClearedAt: { type: Date },
});

const convertUnitsOfInventory = (inventory) => {
    inventory.quantity = { single: inventory.quantity };
    inventory.units.forEach(({ title, value }) => {
        const unitName = title.toLowerCase();

        const { single } = inventory.quantity;

        if (single < value) return;

        const wholeUnits = Math.floor(single / value);
        const remainingSingles = single - wholeUnits * value;

        inventory.quantity[unitName] = [wholeUnits, remainingSingles];
    });
    return inventory;
};

schema.plugin(mongoosePagiante);

const Model = mongoose.model('Inventory', schema);

module.exports = { Model, convertUnitsOfInventory };
