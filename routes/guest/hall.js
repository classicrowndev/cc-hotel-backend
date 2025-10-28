const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const nodemailer = require("nodemailer");
const Hall = require('../../models/hall')

const dotenv = require('dotenv')
dotenv.config()


// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
})

// Book a hall
router.post('/book', async (req, res) => {
    const { token, email, hall_type, location, amount, duration, checkInDate, checkOutDate } = req.body

    if (!token || !email || !hall_type || !amount || !duration || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All required fields must be provided' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Create a new hall request
        const newHallBooking = new Hall({
            guest: guest._id,
            email,
            hall_type,
            location,
            amount,
            duration,
            checkInDate,
            checkOutDate,
            timestamp: Date.now(),
        })

        await newHallBooking.save()

        // Send booking confirmation email
        const mailOptions = {
            from: `"Hotel Reservation" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Hall Booking Confirmation",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Hall Booking Confirmed 🎉</h2>
                    <p>Dear Guest,</p>
                    <p>Your hall booking has been successfully confirmed with the following details:</p>
                    <ul>
                        <li><b>Hall Type:</b> ${hall_type}</li>
                        <li><b>Location:</b> ${location || "Not specified"}</li>
                        <li><b>Amount:</b> ₦${amount}</li>
                        <li><b>Duration:</b> ${duration}</li>
                        <li><b>Check-In Date:</b> ${new Date(checkInDate).toDateString()}</li>
                        <li><b>Check-Out Date:</b> ${new Date(checkOutDate).toDateString()}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>We look forward to hosting your event with us!</p>
                    <br/>
                    <p>Warm regards,<br/>The Hotel Management Team</p>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        return res.status(200).send({
            status: 'success',
            msg: 'Hall booked successfully, confirmation email sent',
            booking: newHallBooking
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error booking hall', error: e.message })
    }
})


// View all hall bookings for a guest
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch all hall bookings
        const bookings = await Hall.find({ guest: guest._id }).sort({ timestamp: -1 })
        if (bookings.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No bookings found for this guest' })
        }

        return res.status(200).send({ status: 'success', count: bookings.length, bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching bookings', error: e.message })
    }
})


// View a specific booking
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and booking ID are required' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the hall booking
        const booking = await Hall.findById(id)

        if (!booking) {
            return res.status(404).send({ status: 'error', msg: 'Booking not found' })
        }

        if (booking.guest.toString() !== guest._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access to this booking' })
        }

        return res.status(200).send({ status: 'success', booking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching booking', error: e.message })
    }
})


// Update a booking
router.post('/update', async (req, res) => {
    const { token, id, ...updateFields } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and booking ID are required' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the hall booking
        const booking = await Hall.findById(id)

        if (!booking) {
            return res.status(404).send({ status: 'error', msg: 'Booking not found' })
        }

        if (booking.guest.toString() !== guest._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized action' })
        }

        const updatedBooking = await Hall.findByIdAndUpdate(id, updateFields, { new: true })
        return res.status(200).send({ status: 'success', msg: 'Booking updated successfully', updatedBooking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating booking', error: e.message })
    }
})


// Cancel a booking
router.post('/cancel', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and booking ID are required' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the hall booking
        const booking = await Hall.findById(id)

        if (!booking) {
            return res.status(404).send({ status: 'error', msg: 'Booking not found' })
        }

        if (booking.guest.toString() !== guest._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access' })
        }

        booking.status = 'Cancelled'
        await booking.save()

        return res.status(200).send({ status: 'success', msg: 'Booking cancelled successfully', booking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling booking', error: e.message })
    }
})

module.exports = router
