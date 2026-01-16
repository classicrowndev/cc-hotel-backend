const mongoose = require("mongoose")

const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["room", "kitchen", "assets", "office"],
        required: true
    },
    category: { type: String, required: true },
    location: { type: String, default: '' }, // Room/Section, Kitchen Section, etc.
    description: { type: String, default: '' },
    unit_of_measurement: { type: String, default: 'units' },
    stock: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    image: {
        img_id: { type: String, default: '' },
        img_url: { type: String, default: '' }
    },
    status: {
        type: String,
        enum: ["In Stock", "Low Stock", "Out of Stock"],
        default: "In Stock"
    },
    last_updated: { type: Date, default: Date.now },
    timestamp: { type: Number, default: Date.now }
}, { collection: 'inventory' })

const model = mongoose.model('Inventory', inventorySchema)
module.exports = model