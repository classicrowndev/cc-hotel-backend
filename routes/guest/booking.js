const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const jwt = require('jsonwebtoken')
const nodemailer = require('../utils/nodemailer')
const Booking = require('../models/booking')
const Room = require('../models/room')


// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS  // app password
    }
})


// Create a new booking (Guest reserves a room)
router.post('/create', async (req, res) => {
    const { token, email, id, amount, duration, no_of_guests, checkInDate, checkOutDate } = req.body

    if (!token || !email || !id || !amount || !duration || !no_of_guests || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled' })
    }

    try {
        // Verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Find the selected room
        const room = await Room.findById(id)
        if (!room) {
            return res.status(400).send({ status: 'error', msg: 'Room not found' })
        }

        // Create a new booking
        const booking = new Booking({
            guest: guest._id,
            email,
            room: room._id,
            room_no: room.name,
            room_type: room.type,
            amount,
            duration,
            no_of_guests,
            checkInDate,
            checkOutDate,
            timestamp: Date.now()
        })

        await booking.save()

        // Mark room as unavailable
        room.availability = false
        await room.save()

        // Send booking confirmation email
        const mailOptions = {
            from: `"Hotel Reservations" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Room Booking Confirmation",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Room Booking Confirmed</h2>
                    <p>Dear Guest,</p>
                    <p>Your booking for <b>${room.name}</b> has been successfully confirmed.</p>
                    <ul>
                        <li><b>Room Type:</b> ${room.type}</li>
                        <li><b>Check-in:</b> ${new Date(checkInDate).toDateString()}</li>
                        <li><b>Check-out:</b> ${new Date(checkOutDate).toDateString()}</li>
                        <li><b>Guests:</b> ${no_of_guests}</li>
                        <li><b>Amount:</b> ₦${amount}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>We look forward to hosting you!</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Reservations Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)

        return res.status(200).send({
            status: 'success',
            msg: 'Room booked successfully and confirmation email sent',
            booking
        })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error creating booking', error: e.message })
    }
})


// View all bookings for the logged-in guest
router.post('/all', async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided.' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the bookings
        const bookings = await Booking.find({ guest: guest._id })
            .populate('room', 'name type price availability')
            .sort({ timestamp: -1 })

        if (!bookings.length) {
            return res.status(200).send({ status: 'ok', msg: 'No bookings found for this guest.' })
        }

        return res.status(200).send({ status: 'success', bookings })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching bookings.', error: e.message })
    }
})


// View a single booking by ID
router.post('/view', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled.' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the booking
        const booking = await Booking.findById(id).populate('room', 'name type price')

        if (!booking) {
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })
        }

        if (booking.guest.toString() !== guest._id.toString()) {
            return res.status(400).send({ status: 'error', msg: 'Unauthorized access to this booking' })
        }

        return res.status(200).send({ status: 'success', booking })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching booking.', error: e.message })
    }
})


// Cancel a booking
router.post('/cancel', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled.' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the booking
        const booking = await Booking.findById(id)

        if (!booking) {
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })
        }

        if (booking.guest.toString() !== guest._id.toString()) {
            return res.status(400).send({ status: 'error', msg: 'Unauthorized access to this booking' })
        }

        if (booking.status === 'Cancelled') {
            return res.status(400).send({ status: 'error', msg: 'Booking already cancelled' })
        }

        booking.status = 'Cancelled'
        await booking.save()

        const room = await Room.findById(booking.room)
        if (room) {
            room.availability = true
            await room.save()
        }

        // Send cancellation email
        const mailOptions = {
            from: `"Hotel Reservations" <${process.env.EMAIL_USER}>`,
            to: booking.email,
            subject: "Room Booking Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Booking Cancelled</h2>
                    <p>Dear Guest,</p>
                    <p>Your booking for <b>${booking.room_no}</b> has been successfully cancelled.</p>
                    <p>If this was a mistake, you can rebook anytime through our website.</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Reservations Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)

        return res.status(200).send({ status: 'success', msg: 'Booking cancelled and email sent', booking })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling booking.', error: e.message })
    }
})

module.exports = router