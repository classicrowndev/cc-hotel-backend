const mongoose = require("mongoose");

const laundryItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        // enum: ["Men", "Women", "Kids", "Bedding", "Household", "Others"], // Optional: restrict if needed
        default: "Others"
    },
    price: {
        type: Number,
        required: true
    },
    price_wash: { type: Number, default: 0 },
    price_iron: { type: Number, default: 0 },
    price_both: { type: Number, default: 0 },
    discount_percentage: { type: Number, default: 0 },
    discount_min_qty: { type: Number, default: 0 },
    discount_enabled: { type: Boolean, default: false },
    last_updated: {
        type: Number,
        default: Date.now
    },
    description: String,
    image: [
        { img_id: String, img_url: String }
    ],
    status: {
        type: String,
        enum: ["Available", "Unavailable"],
        default: "Available"
    },
    timestamp: Number
}, { collection: 'laundry_items' })

const model = mongoose.model('LaundryItem', laundryItemSchema)
module.exports = model