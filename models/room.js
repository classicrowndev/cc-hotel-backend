const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["Standard Suite", "Regular Suite", "Deluxe Room",
            "Platinum Suite", "Premium Suite", "Luxury Suite", "Executive Suite"],
        required: true
    },
    category: {
        type: String,
        enum: ["All", "Suites", "VIP", "Special Offers"],
        default: "All"
    },
    price: { type: Number, required: true },
    capacity: { type: Number, required: true },
    availability: {
        type: String,
        enum: ["Available", "Checked-In", "Booked", "Under Maintenance"],
        default: "Available"
    },
    cleaning_status: {
        type: String,
        enum: ["Clean", "Cleaning", "Untidy"],
        default: "Clean"
    },
    amenities: {
        type: [String],
        enum: ["5G Wi-Fi", "Flat-Screen TV", "Water Dispenser",
            "Luxury Bathroom", "Air Conditioner", "Kitchen"],
        required: true
    },
    images: [
        { img_id: String, img_url: String }
    ],
    description: { type: String },
    checkInDate: Date,
    checkOutDate: Date,
    rating: { type: Number, default: 0 },
    timestamp: Number,
    current_guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    current_booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" }
}, { collection: 'rooms' })

const model = mongoose.model('Room', roomSchema)
module.exports = model