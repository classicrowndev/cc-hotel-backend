const mongoose = require("mongoose")

const eventSchema = new mongoose.Schema({
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    event_name: { type: String, required: true },
    hall: { type: mongoose.Schema.Types.ObjectId, ref: "Hall" },
    hall_name: String,
    description: String,
    total_price: { type: Number, default: 0 },
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