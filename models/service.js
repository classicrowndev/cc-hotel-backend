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
    secondary_name: { type: String, trim: true }, // Optional secondary name
    description: String,
    price: { type: Number, required: true },
    duration_type: { type: String }, // e.g. "per hour", "per session"
    allow_discount: { type: Boolean, default: false },
    discount_min_duration: { type: String }, // e.g. "4 hours"
    discount_percentage: { type: Number }, // e.g. 15
    status: {
        type: String, enum: ["Available", "Unavailable", "Under Maintenance"],
        default: "Available"
    },
    image: [
        { img_id: String, img_url: String }
    ],
    timestamp: Number
}, { collection: 'services' })

const model = mongoose.model('Service', serviceSchema)
module.exports = model