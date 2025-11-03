const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    guest: {type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true},
    hall: {type: mongoose.Schema.Types.ObjectId, ref: "Hall", required: true},
    hall_name: {type: String, required: true},
    description: String,
    total_price: {type: Number, required: true},
    date: Date,
    duration: String,
    location: String,
    availablility: {type: Boolean, default: true},
    status: {type: String, enum: ["Booked", "In Progress", "Completed", "Cancelled", "Overdue"],
        default: "Booked"
    },
    additional_notes: String,
    timestamp: Number
}, { collection: 'events' })

const model = mongoose.model('Event', eventSchema)
module.exports = model