const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const jwt = require('jsonwebtoken')
const nodemailer = require('../utils/nodemailer')
const Booking = require('../models/booking')
const Room = require('../models/room')
const Guest = require('../models/guest')


// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

// Create a new booking/reservation manually (Staff creates on behalf of guest)
router.post('/create', async (req, res) => {
    const { token, guest_id, email, room_id, amount, duration, no_of_guests, checkInDate, checkOutDate } = req.body

    if (!token || !guest_id || !email || !room_id ||
        !amount || !duration || !no_of_guests || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled.' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Restrict staff access
        if (decoded.role === 'Staff' && decoded.task !== 'booking') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const guest = await Guest.findById(guest_id)
        if (!guest) return res.status(400).send({ status: 'error', msg: 'Guest not found.' })

        const room = await Room.findById(room_id)
        if (!room) return res.status(400).send({ status: 'error', msg: 'Room not found.' })

        if (room.availability !== "available") {
            return res.status(400).send({ status: 'error', msg: 'Room is currently unavailable.' })
        }

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
        room.availability = "reserved"
        await room.save()

        const mailOptions = {
            from: `"Hotel Reservations" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Room Booking Confirmation",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Room Booking Confirmed</h2>
                    <p>Dear ${guest.fullname || 'Guest'},</p>
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
                    <p>Warm regards,<br/>Hotel Management Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)
        return res.status(200).send({
            status: 'success',
            msg: 'Booking created successfully and confirmation email sent.',
            booking
        })
    } catch (e) {
        if (e.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error creating booking.', error: e.message })
    }
})


// View all bookings/reservation history (0wner/Admin/Assigned staff)
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided.' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'booking') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const bookings = await Booking.find()
            .populate('guest', 'fullname email phone')
            .populate('room', 'name type price availability')
            .sort({ timestamp: -1 })

        if (!bookings.length) {
            return res.status(200).send({ status: 'ok', msg: 'No bookings found yet.' })
        }

        return res.status(200).send({ status: 'success', bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching bookings.', error: e.message })
    }
})


// View a single booking (0wner/Admin/Assigned staff)
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id)
        return res.status(400).send({ status: 'error', msg: 'Token and booking ID are required.' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.role === 'Staff' && decoded.task !== 'booking')
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })

        const booking = await Booking.findById(id)
            .populate('guest', 'fullname email phone')
            .populate('room', 'name type price availability')

        if (!booking)
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })

        return res.status(200).send({ status: 'success', booking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error fetching booking details.', error: e.message })
    }
})


// Update booking/reservation status (0wner/Admin/Assigned staff)
router.post('/update-status', async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status)
        return res.status(400).send({ status: 'error', msg: 'All fields must be provided.' })

    const validStatuses = ['Booked', 'Checked-in', 'Checked-out', 'Cancelled', 'Overdue']
    if (!validStatuses.includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided.' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'booking')
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })

        const booking = await Booking.findById(id).populate('room')
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found.' })

        booking.status = status
        booking.timestamp = Date.now()
        await booking.save()

        if (status === 'Checked-in') booking.room.availability = 'occupied'
        if (status === 'Checked-out' || status === 'Cancelled') booking.room.availability = 'available'
        await booking.room.save()

        const mailOptions = {
            from: `"Hotel Management" <${process.env.EMAIL_USER}>`,
            to: booking.email,
            subject: `Booking Status Updated to ${status}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Booking Status Updated</h2>
                    <p>Dear Guest,</p>
                    <p>Your booking for <b>${booking.room_no}</b> has been updated.</p>
                    <p><b>New Status:</b> ${status}</p>
                    <br/>
                    <p>Best Regards,<br/>Hotel Management Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)
        return res.status(200).send({
            status: 'success',
            msg: `Booking status updated to ${status} and email sent.`,
            booking
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error updating booking status.', error: e.message })
    }
})


// Delete booking/reservation (0wner/Admin/Assigned staff)
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id)
        return res.status(400).send({ status: 'error', msg: 'Token and booking ID are required.' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.role === 'Staff' && decoded.task !== 'booking')
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })

        const booking = await Booking.findByIdAndDelete(id)
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found or already deleted.' })

        const room = await Room.findById(booking.room)
        if (room) {
            room.availability = 'available'
            await room.save()
        }

        return res.status(200).send({ status: 'success', msg: 'Booking deleted successfully.' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error deleting booking.', error: e.message })
    }
})


// Search bookings (0wner/Admin/Assigned staff)
router.post('/search', async (req, res) => {
    const { token, query } = req.body
    if (!token || !query)
        return res.status(400).send({ status: 'error', msg: 'Token and search query are required.' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.role === 'Staff' && decoded.task !== 'booking')
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to booking operations' })

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })

        const bookings = await Booking.find({
            $or: [
                { room_no: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
            .populate('guest', 'fullname email phone')
            .populate('room', 'name type price')

        if (!bookings.length)
            return res.status(200).send({ status: 'ok', msg: 'No bookings match your search query.' })

        return res.status(200).send({ status: 'success', bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error searching bookings.', error: e.message })
    }
})

module.exports = router