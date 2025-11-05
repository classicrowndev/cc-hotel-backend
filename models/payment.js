const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'Guest', auto: true},
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    phone_no: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN'},
    reference: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['Pending', 'Success', 'Failed'],
        default: 'Pending'
    },
    description: String,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    gateway: { 
        type: String, 
        enum: ['Paystack', 'Stripe', 'Flutterwave'],
        default: 'Paystack'
    }
}, {timestamps: true, collection: 'payments'})

const model = mongoose.model('Payment', paymentSchema)
module.exports = model