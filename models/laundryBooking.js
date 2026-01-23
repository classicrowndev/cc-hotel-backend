const mongoose = require("mongoose");

const laundryBookingSchema = new mongoose.Schema({
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    guest_name: String, // Snapshot in case guest is deleted or walk-in
    email: String,
    phone: String,

    room: { type: String, default: "N/A" }, // Optional room number delivery

    items: [
        {
            item: { type: mongoose.Schema.Types.ObjectId, ref: "LaundryItem" },
            name: String, // Snapshot name
            service_type: String, // e.g. "wash+iron"
            quantity: { type: Number, required: true, default: 1 },
            price: { type: Number, required: true } // Snapshot price per unit
        }
    ],

    total_amount: { type: Number, required: true },
    urgent_fee: { type: Number, default: 0 },
    service_charge: { type: Number, default: 0 },
    discount_enabled: { type: Boolean, default: false },
    discount_amount: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ["Pending", "In Progress", "Ready", "Delivered", "Cancelled"],
        default: "Pending"
    },

    payment_method: {
        type: String,
        enum: ['Cash', 'POS', 'Transfer', 'N/A'],
        default: 'N/A'
    },

    laundry_type: {
        type: String,
        enum: ["Wash", "Iron", "Wash + Iron", "Dry Clean", "Mixed"],
        default: "Mixed"
    },
    priority: {
        type: String,
        enum: ["Standard", "Urgent"],
        default: "Standard"
    },
    payment_status: {
        type: String,
        enum: ["Paid", "Pending", "Failed"],
        default: "Pending"
    },

    delivery_date: Date,
    request_date: { type: Date, default: Date.now },
    timestamp: Number
}, { collection: 'laundry_bookings' })

const model = mongoose.model('LaundryBooking', laundryBookingSchema)
module.exports = model