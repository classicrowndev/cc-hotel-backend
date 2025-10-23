import mongoose from "mongoose"

const serviceRequestSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    email: { type: String, required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    room: { type: String, required: true },
    payment_method: {
        type: String,
        enum: ["Bank Transfer", "Cash Payment", "Debit Card", "Online Payment"],
        required: true
    },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ["Requested", "In Progress", "Completed", "Cancelled"],
        default: "Requested"
    },
    request_date: { type: Date, default: Date.now },
    timestamp: Number
}, { collection: "service_requests" })

const model = mongoose.model("ServiceRequest", serviceRequestSchema)
module.exports = model
