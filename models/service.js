const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    service_type: {
        type: String,
        enum: ['Room Booking', "Spa & Relaxation", "Laundry & Dry Cleaning", "Events & Hall",
            "Bar & Grill", "Fitness Center"],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true // The specific service name under the selected service type
        // e.g.,"Full Body Massage", "Express Laundry", "Wine Tasting Night"
    },
    description: String,
    price: {type: Number, required: true},
    status: {type: String, enum: ["Available", "Unavailable", "Under Maintenance"],
        default: "Available"
    },
    image: String,
    timestamp: Number
}, { collection: 'services' })

const model = mongoose.model('Service', serviceSchema)
module.exports = model