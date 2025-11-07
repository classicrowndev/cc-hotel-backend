const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const Booking = require('../../models/booking')
const Room = require('../../models/room')
const verifyToken = require('../../middleware/verifyToken') // your middleware
const { sendGuestBookingMail, sendGuestBookingCancellationMail } = require('../../utils/nodemailer')



// Create a new booking/reservation (Guest reserves a room)
router.post('/create', verifyToken, async (req, res) => {
    const { email, room_type, duration, no_of_guests, checkInDate, checkOutDate } = req.body

    if (!email || !room_type || !duration || !no_of_guests || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled' })
    }

    try {
        // Find an available room of the requested type
        const room = await Room.findOne ({ type: room_type, availability: 'available' })
        if (!room) {
            return res.status(400).send({ status: 'error', msg: `No available rooms for type: ${room_type}` })
        }

        // Calculate the total amount automatically
        const amount = room.price * duration

        // Create a new booking
        const booking = new Booking({
            guest: req.user._id, // Assuming verifyToken sets req.user
            email,
            room: room._id,
            room_no: room.name,
            room_type: room.type,
            amount,
            duration,
            no_of_guests,
            checkInDate,
            checkOutDate,
            status: 'Booked',
            timestamp: Date.now()
        })

        await booking.save()

        // Mark room as unavailable
        room.availability = "reserved"
        await room.save()

        // Send booking confirmation email
        await sendGuestBookingMail( email, req.user.fullname, // or req.user.name
            room.name, room.type, checkInDate, checkOutDate, no_of_guests, amount
        )

        return res.status(200).send({ status: 'success', msg: 'Room booked successfully and confirmation email sent',
            booking
        })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error creating booking', error: e.message })
    }
})


// View all bookings/reservations for the logged-in guest
router.post('/all', verifyToken, async (req, res) => {
    try {
        // fetch the bookings
        const bookings = await Booking.find({ guest: req.user._id })
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


// View a single booking/reservation by ID
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })
    }

    try {
        // fetch the booking
        const booking = await Booking.findById(id).populate('room', 'name type price')

        if (!booking) {
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })
        }

        if (booking.guest.toString() !== req.user._id.toString()) {
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


// Cancel a booking/reservation
router.post('/cancel', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })
    }

    try {
        // fetch the booking
        const booking = await Booking.findById(id)

        if (!booking) {
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })
        }

        if (booking.guest.toString() !== req.user._id.toString()) {
            return res.status(400).send({ status: 'error', msg: 'Unauthorized access to this booking' })
        }

        if (booking.status === 'Cancelled') {
            return res.status(400).send({ status: 'error', msg: 'Booking already cancelled' })
        }

        booking.status = 'Cancelled'
        await booking.save()

        const room = await Room.findById(booking.room)
        if (room) {
            room.availability = "available"
            await room.save()
        }

        // Send cancellation email
        await sendGuestBookingCancellationMail( booking.email,
            req.user.fullname, // or guest name
            booking.room_no
    )

        return res.status(200).send({ status: 'success', msg: 'Booking cancelled and email sent', booking })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling booking.', error: e.message })
    }
})


module.exports = router