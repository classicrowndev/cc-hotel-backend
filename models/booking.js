const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true },
    email: { type: String, required: true },
    rooms: [{
        room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
        room_no: String,
        room_type: String,
        price: Number,
        status: {
            type: String,
            enum: ["Booked", "Checked-in", "Checked-out", "Cancelled"],
            default: "Booked"
        }
    }],
    payment_method: {
        type: String,
        enum: ["Cash", "POS", "Transfer", "Online", "Card"], // "Card" often mapped to POS or separate, adding strictly based on UI or common sense, but sticking to plan + standard
        default: "Cash"
    },
    payment_status: {
        type: String,
        enum: ["Paid", "Pending", "Partial"],
        default: "Pending"
    },
    amount: Number,
    status: {
        type: String, enum: ["Booked", "Checked-in", "Checked-out", "Cancelled", "Overdue"],
        default: "Booked"
    },
    booking_type: { type: String, enum: ["Online", "Direct"], default: "Online" },
    duration: Number,
    no_of_guests: { type: Number, default: 0 },
    checkInDate: Date,
    checkOutDate: Date,
    timestamp: Number
}, { collection: 'bookings' })

const model = mongoose.model('Booking', bookingSchema)
module.exports = model