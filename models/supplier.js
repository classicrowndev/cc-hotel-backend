const mongoose = require('mongoose')
const Schema = mongoose.Schema

const supplierSchema = new Schema({
    name: { type: String, required: true },
    phone_no: { type: String, required: true },
    email: { type: String },
    office_address: { type: String },
    category: { type: String }, // e.g., Food, Laundry, Maintenance
    last_supply: { type: Date, default: null },
    total_supply: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    timestamp: { type: Number, default: Date.now }
}, { collection: 'suppliers', timestamps: true })

const model = mongoose.model('Supplier', supplierSchema)
module.exports = model
