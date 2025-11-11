const mongoose = require('mongoose')

const statsSchema = new mongoose.Schema({
    totalGuests: { type: Number, default: 0 },
    totalStaff: { type: Number, default: 0 },
    totalRooms: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalEventsBooked: { type: Number, default: 0 },
    totalServiceRequests: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'statistics' })


const model = mongoose.model('Statistics', statsSchema)
module.exports = model