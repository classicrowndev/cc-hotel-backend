const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    email: { type: String, required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    room: { type: String, required: true },
    amount: { type: Number, required: true },
    duration: { type: String }, // e.g. "1 hour", "3 sessions"
    delivery_date: { type: Date },
    payment_method: {
        type: String,
        enum: ['Cash', 'POS', 'Transfer', 'N/A'],
        default: 'N/A'
    },
    payment_status: {
        type: String,
        enum: ["Paid", "Pending", "Failed"],
        default: "Pending"
    },
    status: {
        type: String,
        enum: ["Pending", "In Progress", "Completed", "Cancelled"],
        default: "Pending"
    },
    request_date: { type: Date, default: Date.now },
    timestamp: Number
}, { collection: "service_requests" })

const model = mongoose.model("ServiceRequest", serviceRequestSchema)
module.exports = model
