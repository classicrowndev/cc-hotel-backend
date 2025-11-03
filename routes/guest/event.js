const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const Event = require('../../models/event')
const verifyToken = require('../../middleware/verifyToken')
const { sendGuestEventMail, sendGuestEventCancellationMail } = require("../../utils/nodemailer")



// Reserve or register for an event
router.post('/reserve', verifyToken, async (req, res) => {
    try {
        const { hallId, description, date, duration } = req.body
        if (!hallId || !date) {
            return res.status(400).send({ status: 'error', msg: 'Hall ID and date must be provided' })
        }

        const guestId = req.user.id // from verifyToken middleware

        // Find guest details
        const guest = await Guest.findById(guestId)
        if (!guest) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        // Find the hall being booked
        const hall = await Hall.findById(hallId)
        if (!hall){
            return res.status(404).send({ status: 'error', msg: 'Hall not found' })
        }
    
        // Check if hall is available
        if (hall.status !== "Available") {
            return res.status(404).send({ status: 'error', msg: 'This hall is not available for booking at the moment' })
        }

        // Check if that hall is available for that exact date  or already booked for that date
        const requestedDate = new Date(date)
        const conflict = await Event.findOne({
            hall: hall._id,
            date: {
                $eq: requestedDate
            },
            status: { $in: ['Booked', 'In Progress'] }
        })

        if (conflict) {
            return res.status(400).send({ status: 'error', msg: 'Hall already booked for that date' })
        }
    
        // Book for a new event
        const newBooking = new Event({
            guest: guest._id,
            hall: hall._id,
            hall_name: hall.name,
            description: description || `Booking for ${hall.name}`,
            amount: hall.amount,
            date: requestedDate,
            location: hall.location,
            availablility: true,
            status: "Booked",
            image,
            timestamp: Date.now(),
        })

        await newBooking.save()

        // Update the hall 's status to "Booked"
        hall.status = "Booked"

        // Send confirmation email
        await sendGuestEventMail( guest.email, guest.fullname, hall.name, hall.location, hall.amount, hall.hall_type,
            date)

        return res.status(201).send({status: 'success', msg: 'Hall reserved successfully and confirmation email sent',
            booking: newBooking,
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error reserving event', error: e.message })
    }
})


// View all available events
router.post('/all', verifyToken, async (req, res) => {
    try {
        // fetch all available events
        const events = await Event.find({ availablility: true }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No available events found' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching events', error: e.message })
    }
})


// View details of a single event
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Event ID is required' })
    }

    try {
        // fetch the event
        const event = await Event.findById(id)
        if (!event) {
            return res.status(400).send({ status: 'error', msg: 'Event not found' })
        }

        return res.status(200).send({ status: 'success', event })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching event details', error: e.message })
    }
})


// Filter events by status
router.post('/filter', verifyToken, async (req, res) => {
    const { status } = req.body

    if (!status) {
        return res.status(400).send({ status: 'error', msg: 'Status is required' })
    }

    try {
        // fetch the events' status
        const events = await Event.find({ status }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No events found for this status' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error filtering events', error: e.message })
    }
})


// Search events by name
router.post('/search', verifyToken, async (req, res) => {
    const { keyword } = req.body

    if (!keyword) {
        return res.status(400).send({ status: 'error', msg: 'Token and keyword are required' })
    }

    try {
        // fetch the events
        const events = await Event.find({
            name: { $regex: keyword, $options: 'i' },
            availablility: true
        }).sort({ timestamp: -1 })

        if (events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No matching events found' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error searching events', error: e.message })
    }
})


// Cancel reserved event
router.post('/cancel', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Event ID are required' })
    }

    try {
        // fetch the event
        const event = await Event.findById(id)
        if (!event) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }

        event.status = "Cancelled"
        await event.save()

        // Send cancellation email
        await sendGuestEventCancellationMail( guest.email, guest.fullname, event.name, event.date)

        return res.status(200).send({ status: 'success', msg: 'Event cancelled successfully, confirmation email sent' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling event', error: e.message })
    }
})

module.exports = router
