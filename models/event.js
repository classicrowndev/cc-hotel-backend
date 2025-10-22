import mongoose from "mongoose"

const eventSchema = new mongoose.Schema({
    name: {type: String, required: true},
    description: String,
    price: {type: Number, required: true},
    date: Date,
    location: String,
    availablility: {type: boolean, default: true},
    status: {type: String, enum: ["Booked", "In Progress", "Completed", "Cancelled", "Overdue"],
        default: "Booked"
    },
    image: String,
    timestamp: Number
}, { collection: 'events' })

const model = mongoose.model('Event', eventSchema)
module.exports = model