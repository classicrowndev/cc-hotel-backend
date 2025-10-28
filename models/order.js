const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    guest: {type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true},
    email: {type: String, required: true},
    dishes: [
        {
            name: String,
            quantity: Number,
            price: Number
        }
    ],
    status: {type: String, enum: ["Order Placed", "Preparing", "Served", "Delivered", "Cancelled"],
        default: "Order Placed"
    },
    room: String, 
    amount: Number,
    payment_method: {type: String, 
        enum: ["Bank Transfer", "Cash payment", "Debit Card", "Online Order"],
    }, 
    order_date: {type: Date, default: Date.now},
    timestamp: Number
}, { collection: 'orders' })

const model = mongoose.model('Order', orderSchema)
module.exports = model