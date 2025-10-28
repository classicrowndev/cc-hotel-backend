const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, auto: true},
    guest: {type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true},
    email: {type: String, required: true},
    room: {type: mongoose.Schema.Types.ObjectId, ref: "Room"},
    room_no: String,
    room_type: String,
    amount: {type: Number, required: true},
    status: {type: String, enum: ["Booked", "Checked-in", "Checked-out", "Cancelled", "Overdue"],
        default: "Booked"},
    duration: String, // e.g. "3D 3N"
    no_of_guests: {type: Number, default: 0},
    checkInDate: Date,
    checkOutDate: Date,
    timestamp: Number
}, { collection: 'bookings' })

const model = mongoose.model('Booking', bookingSchema)
module.exports = model