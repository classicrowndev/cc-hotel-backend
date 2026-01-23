const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    order_id: { type: String }, // Short ID e.g. "3021"
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    email: { type: String, required: true },
    dishes: [
        {
            name: String,
            quantity: Number,
            price: Number
        }
    ],
    status: {
        type: String, enum: ["Order Placed", "Preparing", "Order Served", "Order Delivered", "Order Cancelled"],
        default: "Order Placed"
    },
    room: String,
    amount: Number,
    vat: { type: Number, default: 0 },
    payment_method: { type: String, enum: ["Cash", "Card", "Transfer", "Room Charge", "Pending"], default: "Pending" },
    order_date: { type: Date, default: Date.now },
    timestamp: Number
}, { collection: 'orders' })

const model = mongoose.model('Order', orderSchema)
module.exports = model