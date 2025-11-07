const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const Booking = require('../../models/booking')
const Room = require('../../models/room')
const Guest = require('../../models/guest')
const verifyToken = require('../../middleware/verifyToken') // your middleware
const { sendGuestBookingMail, sendGuestBookingStatusMail } = require('../../utils/nodemailer')

//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}

// Create a new booking/reservation manually (Staff creates on behalf of guest)
router.post('/create', verifyToken, async (req, res) => {
    const { guest_id, email, room_id, amount, duration, no_of_guests, checkInDate, checkOutDate } = req.body

    if (!guest_id || !email || !room_id ||
        !amount || !duration || !no_of_guests || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All fields must be filled.' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const guest = await Guest.findById(guest_id)
        const room = await Room.findById(room_id)
        if (!guest || !room) return res.status(400).send({ status: 'error', msg: 'Guest or Room not found.' })

        if (room.availability !== "available") {
            return res.status(400).send({ status: 'error', msg: 'Room is currently unavailable.' })
        }

        const amount = room.price * duration

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
            status: 'Booked',
            timestamp: Date.now()
        })

        await booking.save()
        room.availability = "reserved"
        await room.save()

        // Send booking confirmation email to the Guest
        await sendGuestBookingMail(
            guest.email,
            guest.fullname,
            room.name,
            room.type,
            checkInDate,
            checkOutDate,
            no_of_guests,
            amount
        )

        return res.status(200).send({ status: 'ok', msg: 'success', booking })
    } catch (e) {
        if (e.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all bookings/reservation history (0wner/Admin/Assigned staff)
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }
    
    try {
        const bookings = await Booking.find()
            .populate('guest', 'fullname email phone')
            .populate('room', 'name type price availability')
            .sort({ timestamp: -1 })

        if (!bookings.length) {
            return res.status(200).send({ status: 'ok', msg: 'No bookings found yet.' })
        }

        return res.status(200).send({ status: 'ok', bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View a single booking (0wner/Admin/Assigned staff)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(id)
            .populate('guest', 'fullname email phone')
            .populate('room', 'name type price availability')

        if (!booking)
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })

        return res.status(200).send({ status: 'ok', booking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update booking/reservation status (0wner/Admin/Assigned staff)
router.post('/update-status', verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status)
        return res.status(400).send({ status: 'error', msg: 'All fields must be provided.' })

    const validStatuses = ['Booked', 'Checked-in', 'Checked-out', 'Cancelled', 'Overdue']
    if (!validStatuses.includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(id).populate('room')
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found.' })

        booking.status = status
        booking.timestamp = Date.now()
        await booking.save()

        if (['Checked-out', 'Cancelled'].includes(status)) booking.room.availability = 'available'

        if (status === 'Checked-in') booking.room.availability = 'occupied'
        await booking.room.save()

        // Send booking status email
        await sendGuestBookingStatusMail(
            booking.email,
            booking.guest.fullname,
            booking.room.name,
            status
        )

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            booking
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete booking/reservation (0wner/Admin/Assigned staff)
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findByIdAndDelete(id)
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found or already deleted.' })

        const room = await Room.findById(booking.room)
        if (room) {
            room.availability = 'available'
            await room.save()
        }

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Search bookings (0wner/Admin/Assigned staff)
router.post('/search', verifyToken, async (req, res) => {
    const { query } = req.body
    if (!query)
        return res.status(400).send({ status: 'error', msg: 'Search query is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
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
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router