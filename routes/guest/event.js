const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const Event = require('../../models/event')
const Guest = require('../../models/guest')
const Hall = require('../../models/hall')
const verifyToken = require('../../middleware/verifyToken')
const { sendGuestEventRequestMail, sendGuestEventCancellationMail } = require('../../utils/nodemailer')


// GUEST REQUESTS TO RESERVE A HALL (PENDING APPROVAL)
router.post('/reserve', verifyToken, async (req, res) => {
    try {
        const { hallId, description, date, duration, start_time, end_time, additional_notes } = req.body

        if (!hallId || !date || !duration) {
            return res.status(400).send({ status: 'error', msg: 'Hall ID, date, and duration are required.' })
        }

        const guestId = req.user.id

        const guest = await Guest.findById(guestId);
        if (!guest) return res.status(404).send({ status: 'error', msg: 'Guest not found.' })

        const hall = await Hall.findById(hallId)
        if (!hall) return res.status(404).send({ status: 'error', msg: 'Hall not found.' })

        // Check if hall already has an event on that same date and time
        const requestedDate = new Date(date)
        const conflict = await Event.findOne({
            hall: hall._id,
            date: requestedDate,
            status: { $in: ['Pending', 'Approved', 'In Progress'] }
        })

        if (conflict) {
            return res.status(400).send({ status: 'error', msg: 'This hall is already requested or booked for that date.' })
        }

        // Calculate total price (for example: hall.amount * duration in hours)
        const total_price = hall.amount * Number(duration)

        const newEvent = new Event({
            guest: guest._id,
            hall: hall._id,
            hall_name: hall.name,
            description: description || `Booking request for ${hall.name}`,
            total_price,
            date: requestedDate,
            duration,
            start_time,
            end_time,
            location: hall.location,
            availability: true,
            status: 'Pending', // Waiting for staff approval
            additional_notes,
            timestamp: Date.now()
        })

        await newEvent.save();

        // Send confirmation email (request received)
        await sendGuestEventRequestMail(
            guest.email,
            guest.fullname,
            hall.name,
            hall.location,
            hall.amount,
            hall.hall_type,
            date
        )

        return res.status(201).send({
            status: 'success',
            msg: 'Booking request submitted successfully. Awaiting approval from management.',
            event: newEvent
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error submitting booking request', error: e.message })
    }
})


// VIEW ALL EVENTS (OWNED BY GUEST)
router.post('/all', verifyToken, async (req, res) => {
    try {
        const guestId = req.user.id
        const events = await Event.find({ guest: guestId }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'You have not made any event requests yet.' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error fetching your events', error: e.message })
    }
})


// VIEW DETAILS OF A SINGLE EVENT
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required.' })

    try {
        const event = await Event.findById(id).populate('hall').populate('guest')
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found.' })

        return res.status(200).send({ status: 'success', event })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error fetching event details', error: e.message })
    }
})


// FILTER EVENTS BY STATUS (e.g. Pending, Approved, Cancelled)
router.post('/filter', verifyToken, async (req, res) => {
    const { status } = req.body
    if (!status) return res.status(400).send({ status: 'error', msg: 'Status is required.' })

    try {
        const guestId = req.user.id
        const events = await Event.find({ guest: guestId, status }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: `No ${status.toLowerCase()} events found.` })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error filtering events', error: e.message })
    }
})


// SEARCH EVENTS BY HALL NAME OR DESCRIPTION
router.post('/search', verifyToken, async (req, res) => {
    const { keyword } = req.body
    if (!keyword) return res.status(400).send({ status: 'error', msg: 'Keyword is required.' })

    try {
        const guestId = req.user.id
        const events = await Event.find({
            guest: guestId,
            $or: [
                { hall_name: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
            ]
        }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No matching events found.' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error searching events', error: e.message })
    }
})


// CANCEL EVENT REQUEST (ONLY IF PENDING OR APPROVED)
router.post('/cancel', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required.' })

    try {
        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found.' })

        if (['Completed', 'Cancelled'].includes(event.status)) {
            return res.status(400).send({ status: 'error', msg: `Cannot cancel an event that is already ${event.status}.` })
        }

        event.status = 'Cancelled'
        await event.save()

        const guest = await Guest.findById(event.guest)
        await sendGuestEventCancellationMail(
            guest.email,
            guest.fullname,
            event.hall_name,
            event.date
        )

        return res.status(200).send({ status: 'success', msg: 'Event cancelled successfully.' })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error cancelling event', error: e.message })
    }
})

module.exports = router