import mongoose from "mongoose"

const policySchema = new mongoose.Schema({
    title: {type: String, enum: ["Privacy Policy", "Terms of Service"], required: true},
    content: {type: String, required: true},
    timestamp: Number
}, { collection: 'policies' })

const model = mongoose.model('Policy', policySchema)
module.exports = model