const mongoose = require("mongoose")

const hallSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    name: {type: String, required: true}, // Each hall name must be unique, e.g. "Emerald Hall", "Diamond Ballroom"
    hall_type: {
        type: String,
        enum: ["Conference Hall", "Banquet Hall B", "Boardroom", "Grand Ballroom"],
        required: true
    },
    description: String,
    location: {
        type: String,
        enum: ["Ground Floor", "First Floor", "Second Floor"]
    },
    amenities: { type: String, enum: ["Sound System", "Air Conditioning", "Projector",
        "Catering Service", "Stage", "Parking Space"]
    },
    capacity: {type: Number, required: true}, //No. of guests the hall can contain
    status: {type: String, enum: ["Available", "Booked", "In Progress", "Completed", "Cancelled", "Overdue"],
        default: "Available"
    },
    amount: {type: Number, required: true}, // Default price per event/day
    duration: String, // e.g. "3D 3N"
    image: String,
    checkInDate: Date,
    checkOutDate: Date,
    timestamp: Number
}, { collection: 'halls' })

const model = mongoose.model('Hall', hallSchema)
module.exports = model