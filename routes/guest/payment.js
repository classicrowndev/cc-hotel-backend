const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()


const verifyToken = require('../../middleware/verifyToken')
const crypto = require('crypto')
const Payment = require('../../models/payment')
const Guest = require('../../models/guest')
const Booking = require('../../models/booking')
const Order = require('../../models/order')
const Event = require('../../models/event')
const Service = require('../../models/service');
const { createPayment } = require('../../controllers/paystack') // your paystack file
const { sendPaymentSuccessMail } = require('../../utils/nodemailer')


const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_TEST_SECRET_KEY


// Verify Paystack signature
function verifyPaystackSignature(signature, requestBody, secretKey) {
    const hash = crypto.createHmac('sha512', secretKey).update(requestBody).digest('hex')
    return hash === signature
}


// Initialize payment
router.post('/initialize', async (req, res) => {
    try {
        const { email, amount, fullname, phone_no, payment_method, type, 
            description, bookingId, orderId, eventId, serviceId } = req.body

        // Create a unique reference
        const reference = Date.now().toString()

        // Save a pending payment first
        const payment = new Payment({
            fullname,
            email,
            phone_no,
            amount,
            reference,
            payment_method,
            description: `${type} payment`,
            booking: type === 'booking' ? bookingId : undefined,
            orderId: type === 'order' ? orderId : undefined,
            eventId: type === 'event' ? eventId : undefined,
            serviceId: type === 'service' ? serviceId : undefined,
            status: 'Pending',
        })

        await payment.save()

        // Initialize payment on Paystack
        const response = await createPayment(email, amount)

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            data: response,
            reference
        })
    } catch (error) {
        console.error('Error initializing payment:', error.message)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Confirm payment webhook
router.post('/confirm', async (req, res) => {
    const event = req.body;
    const signature = req.headers['x-paystack-signature']

    try {
        const isValidSignature = verifyPaystackSignature(signature, JSON.stringify(req.body), PAYSTACK_SECRET_KEY)
        if (!isValidSignature) {
            console.error('Invalid Paystack signature')
            return res.status(400).json({ error: 'Invalid signature' })
        }

        res.status(200).send('Webhook received')

        const reference = event.data.reference

        if (event.event === 'charge.success') {
            const payment = await Payment.findOneAndUpdate({ reference }, { status: 'Success' }, { new: true })
            .populate(['booking', 'order', 'event', 'service'])

            if (!payment) {
                return console.log('Payment not found:', reference)
            }

            // Handle payment depending on its type
            if (payment.booking) {
                await Booking.findByIdAndUpdate(payment.booking._id, { payment_status: 'Paid' })
            
                // Send payment confirmation email
                await sendPaymentSuccessMail(payment.email, payment.fullname, payment.amount, payment.reference, 'booking')
                console.log('Booking payment confirmed')
           }

            else if (payment.order) {
                await Order.findByIdAndUpdate(payment.order._id, { payment_status: 'Paid' })
                
                // Send payment confirmation email
                await sendPaymentSuccessMail(payment.email, payment.fullname, payment.amount, payment.reference, 'order')    
                console.log('Order payment confirmed')
            }

            else if (payment.event) {
                await Event.findByIdAndUpdate(payment.event._id, { payment_status: 'Paid' })
                
                // Send payment confirmation email
                await sendPaymentSuccessMail(payment.email, payment.fullname, payment.amount, payment.reference, 'event')    
                console.log('Event payment confirmed')
            }

            else if (payment.service) {
                await Service.findByIdAndUpdate(payment.service._id, { payment_status: 'Paid' })
                
                // Send payment confirmation email
                await sendPaymentSuccessMail(payment.email, payment.fullname, payment.amount, payment.reference, 'service')    
                console.log('Service payment confirmed')
            }

        } else if (event.event === 'charge.failed') {
            await Payment.findOneAndUpdate({ reference }, { status: 'Failed' })
            console.log('Payment failed:', reference)
        } else {
            console.log('Unhandled Paystack event:', event.event)
        }
    } catch (error) {
        console.error('Error confirming payment:', error.message)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
})


// View guest's payments
router.get('/view', verifyToken, async (req, res) => {
    try {
        const { _id } = req.user
        const payments = await Payment.find({ guest: _id }).lean()

        if (!payments.length) {
            return res.status(200).send({ status: 'ok', msg: 'No payments found', payments: [] })
        }

        return res.status(200).send({ status: 'ok', payments })
    } catch (error) {
        console.error('Error fetching payments:', error.message);
        return res.status(500).send({ status: 'error', msg: 'Failed to fetch payments' })
   }
})


module.exports = router