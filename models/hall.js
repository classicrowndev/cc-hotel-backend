const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    guest: {type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true},
    email: {type: String, required: true},
    hall_type: {
        type: String,
        enum: ["Conference Hall", "Banquet Hall B", "Boardroom", "Grand Ballroom"],
        required: true
    },
    location: {
        type: String,
        enum: ["Ground Floor", "First Floor", "Second Floor"]
    },
    status: {type: String, enum: ["Booked", "In Progress", "Completed", "Cancelled", "Overdue"],
        default: "Booked"
    },
    amount: {type: Number, required: true},
    duration: String, // e.g. "3D 3N"
    checkInDate: Date,
    checkOutDate: Date,
    timestamp: Number
}, { collection: 'halls' })

const model = mongoose.model('Hall', hallSchema)
module.exports = model