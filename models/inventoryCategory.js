const mongoose = require("mongoose")

const inventoryCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["room", "kitchen", "assets", "office"],
        required: true
    },
    description: { type: String, default: '' },
    timestamp: { type: Number, default: Date.now }
}, { collection: 'inventory_categories', timestamps: true })

const model = mongoose.model('InventoryCategory', inventoryCategorySchema)
module.exports = model