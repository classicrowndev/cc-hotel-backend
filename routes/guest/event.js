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
        const { event_name, description, date, duration, start_time, end_time, additional_notes } = req.body

        if (!event_name || !date || !duration) {
            return res.status(400).send({ status: 'error', msg: 'Event name, date and duration are required.' })
        }

        const guestId = req.user._id

        const guest = await Guest.findById(guestId);
        if (!guest) return res.status(404).send({ status: 'error', msg: 'Guest not found.' })


        const newEvent = new Event({
            guest: guest._id,
            event_name,
            hall: null, // No hall yet, staff will assign upon approval
            hall_name: null,
            description: description || `Event request for ${event_name}`,
            total_price: 0, // Calculated later
            date: new Date(date),
            duration,
            start_time,
            end_time,
            location: null,
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
            event_name,
            date
        )

        return res.status(201).send({
            status: 'ok',
            msg: 'success',
            event: newEvent
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// VIEW ALL EVENTS (OWNED BY GUEST)
router.post('/all', verifyToken, async (req, res) => {
    try {
        const guestId = req.user._id
        const events = await Event.find({ guest: guestId }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No events found', count: 0, events: [] })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: events.length, events })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// VIEW DETAILS OF A SINGLE EVENT
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required.' })

    try {
        const event = await Event.findById(id).populate('guest')
        .populate('hall', 'name location hall_type amount') // optional populate
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found.' })

        return res.status(200).send({ status: 'ok', msg: 'success', event })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// FILTER EVENTS BY STATUS (e.g. Pending, Approved, Cancelled)
router.post('/filter', verifyToken, async (req, res) => {
    const { status } = req.body
    if (!status) return res.status(400).send({ status: 'error', msg: 'Status is required.' })

    try {
        const guestId = req.user._id
        const events = await Event.find({ guest: guestId, status }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No events found', count: 0 })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: events.length, events })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
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
            return res.status(200).send({ status: 'ok', msg: 'No events found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', events, count: events.length })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// CANCEL EVENT REQUEST (ONLY IF PENDING OR APPROVED)
router.post('/cancel', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required.' })

    try {
        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found.' })

        if (!['Pending', 'Approved'].includes(event.status)) {
            return res.status(400).send({ status: 'error', msg: `Cannot cancel an event that is already ${event.status}.` })
        }

        event.status = 'Cancelled'
        await event.save()

        const guest = await Guest.findById(event.guest)
        await sendGuestEventCancellationMail(
            guest.email,
            guest.fullname,
            event.hall_name,
            event.date,
            event.status
        )

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router