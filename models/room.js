import mongoose from "mongoose"

const roomSchema = new mongoose.Schema({
    name: {type: String, required: true},
    type: {
        type: String,
        enum: ["Standard suite", "Regular suite", "Deluxe suite", "Platinum suite", "Premium suite"],
        required: true
    },
    price: {type: Number, required: true},
    capacity: {type: Number, required: true},
    availability: {
        type: String,
        enum: ["available", "occupied", "reserved", "maintenance"],
        default: "available"
    },
    amenities: {
        type: String, 
        enum: ["5G Wi-Fi", "Flat-Screen TV", "Water Dispenser",
            "Luxury Bathroom", "Air Conditioner", "Kitchen"],
        required: true
    },
    images: String,
    description: {type: String},
    checkInDate: Date,
    checkOutDate: Date,
    timestamp: Number
}, { collection: 'rooms' })

const model = mongoose.model('Room', roomSchema)
module.exports = model