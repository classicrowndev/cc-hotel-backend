const mongoose = require("mongoose")

const contactSchema = new mongoose.Schema({
    fullname: {type: String, required: [true, "Full name is required"]},
    email: {type: String, required: [true, "Email address is required"], lowercase: true},
    phone_no: String,
    subject: {type: String, enum: [ "General Inquiry", "Room Booking", "Event Reservation", "Partnership",
        "Complaint", "Other"], default: "General Inquiry"
    },
    message: {type: String, required: [true, "Message cannot be empty"]},
    preferred_Contact_Method: { type: String, enum: ["email", "phone"], default: "email" },
    is_Replied: { type: Boolean, default: false },
    replied_By: { type: mongoose.Schema.Types.ObjectId, ref: "Staff"},
    reply_Message: { type: String },
    status: { type: String, enum: ["new", "in-progress", "resolved", "closed"], default: "new"},
    timestamp: Number
}, { collection: 'contacts' })

const model = mongoose.model('Contact', contactSchema)
module.exports = model