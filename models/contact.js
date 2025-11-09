const mongoose = require("mongoose")

const contactSchema = new mongoose.Schema({
    address: { type: String, required: true},
    email: [{ type: String, required: true }], // array if multiple emails
    phone_no: [{ type: String, required: true }], // array if multiple phone numbers
    timestamp: Number
}, { collection: 'contacts' })

const model = mongoose.model('Contact', contactSchema)
module.exports = model