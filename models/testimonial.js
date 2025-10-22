import mongoose from "mongoose"

const testimonialSchema = new mongoose.Schema({
    guest: {type: mongoose.Schema.Types.ObjectId, ref: "Guest", required: true},
    comment: {type: String, required: true},
    rating: {type: Number, min: 1, max: 5},
    timestamp: Number
}, { collection: 'testimonials' })

const model = mongoose.model('Testimonial', testimonialSchema)
module.exports = model