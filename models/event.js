const mongoose = require("mongoose")

const eventSchema = new mongoose.Schema({
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    hall: { type: mongoose.Schema.Types.ObjectId, ref: "Hall", required: true },
    hall_name: { type: String, required: true },
    description: String,
    total_price: { type: Number, required: true },
    date: Date,
    duration: String,
    start_time: String,
    end_time: String,
    location: String,
    availability: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ["Pending", "Approved", "In Progress", "Completed", "Cancelled"],
        default: "Pending"
    },
    additional_notes: String,
    timestamp: Number
}, { collection: 'events', timestamps: true })

const model = mongoose.model('Event', eventSchema)
module.exports = model