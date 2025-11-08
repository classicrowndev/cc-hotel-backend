const mongoose = require("mongoose")

const dishSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    name: {type: String, required: true},
    category: {
        type: String,
        enum: ["Breakfast", "Main Meal", "Swallow", "Soup",
            "Bar & Drinks", "Beverages", "Meat & Fish", "Snacks & Desserts"
        ]
    },
    isReady: { type: Boolean, default: false },
    quantity: {type: Number, default: 0},
    amount_per_portion: {type: Number, default: 0},
    images: [
        { img_id: String, img_url: String }
    ],
    date_added: {type: Date, default: Date.now},
    last_ordered: Date,
    createdAt: {type: Date, default: Date.now},
    timestamp: Number
}, { collection: 'dishes' })

const model = mongoose.model('Dish', dishSchema)
module.exports = model