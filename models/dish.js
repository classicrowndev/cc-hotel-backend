const mongoose = require("mongoose")

const dishSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    name: {type: String, required: true},
    category: {
        type: String,
        enum: ["Breakfast", "Main Meal", "Swallow", "Soups",
            "Bar & Drinks", "Beverages", "Meat & Fish", "Snack & Desserts"
        ]
    },
    status: {type: String, enum: ["Available", "Unavailable"], default: "Available"},
    quantity: {type: Number, default: 0},
    amount_per_portion: {type: Number, default: 0},
    image: String,
    date_added: {type: Date, default: Date.now},
    last_ordered: Date,
    createdAt: {type: Date, default: Date.now},
    timestamp: Number
}, { collection: 'dishes' })

const model = mongoose.model('Dish', dishSchema)
module.exports = model