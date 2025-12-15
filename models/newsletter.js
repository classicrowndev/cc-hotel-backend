const mongoose = require('mongoose')

const newsletterSchema = new mongoose.Schema({
    email: String,
    subscribed_at: {
        type: Date,
        default: Date.now
    }
}, { timestamp: true, collection: 'newsletter' })

module.exports = mongoose.model('Newsletter', newsletterSchema)