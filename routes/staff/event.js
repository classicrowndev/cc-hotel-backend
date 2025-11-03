const express = require('express')
const router = express.Router()
const dotenv = require('dotenv')
dotenv.config()

const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const Event = require('../../models/event')
const verifyToken = require('../../middleware/verifyToken')

// Role checker helper
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role)) return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired) return false
        return true
}

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_EMAIL_PASS
    }
})


// Add New Event (Only Owner/Admin)
router.post('/add', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new events.' })
        }

        const { title, description, date, venue, time, contactEmail } = req.body
        if (!title || !description || !date || !venue || !time || !contactEmail) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        const newEvent = new Event({
            title,
            description,
            date,
            venue,
            time,
            contactEmail,
            createdBy: req.user.fullname
        })
        await newEvent.save()

        // Send confirmation email
        await transporter.sendMail({
            from: process.env.ADMIN_EMAIL,
            to: contactEmail,
            subject: `New Event Added: ${title}`,
            text: `Dear Member,\n\nA new event has been added: ${title}\nDate: ${date}\nVenue: ${venue}\n\nDescription: ${description}\n\nThank you.`
        })

        res.status(201).send({ status: 'ok', msg: 'Event created successfully', event: newEvent })
    } catch (e) {
        console.error('Error creating event:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to create event' })
    }
})


// View All Events (Owner/Admin or Assigned Staff)
router.post('/all', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        const events = await Event.find().sort({ createdAt: -1 })
        res.status(200).send({ status: 'ok', events })
    } catch (e) {
        console.error('Error fetching events:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to fetch events' })
    }
})


// View Single Event (Owner/Admin or Assigned Staff)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        res.status(200).send({ status: 'ok', event })
    } catch (e) {
        console.error('Error fetching event:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to fetch event details' })
    }
})


// Update Event Details (Owner/Admin)
router.post('/update', verifyToken, async (req, res) => {
    try {
        if (!['Owner', 'Admin'].includes(req.user.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update event.' })
        }

        const { id, title, description, date, venue, time, contactEmail } = req.body
        if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

        const updatedEvent = await Event.findByIdAndUpdate(id,
            { title, description, date, venue, time, contactEmail },
            { new: true }
        )

       if (!updatedEvent) return res.status(404).send({ status: 'error', msg: 'Event not found' })
       res.status(200).send({ status: 'ok', msg: 'Event updated successfully', updatedEvent })
    } catch (e) {
        console.error('Error updating event:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to update event' })
    }
})


// Update Event Status (Owner/Admin)
router.post('/update_status', verifyToken, async (req, res) => {
    try {
        if (!['Owner', 'Admin'].includes(req.user.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update event status.' })
        }

        const { id, status } = req.body
        if (!id || !status)
            return res.status(400).send({ status: 'error', msg: 'Event ID and status are required' })

        const updatedEvent = await Event.findByIdAndUpdate(id, { status }, { new: true })
        if (!updatedEvent) 
            return res.status(404).send({ status: 'error', msg: 'Event not found' })

        res.status(200).send({ status: 'ok', msg: 'Event status updated successfully', updatedEvent })
    } catch (e) {
        console.error('Error updating event status:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to update event status' })
    }
})


// Cancel Event
router.post('/cancel', verifyToken, async (req, res) => {
    try {
        if (!['Owner', 'Admin'].includes(req.user.role)) {
            return 
            res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can cancel event.' })
        }

        const { id } = req.body
        if (!id) 
            return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

        const event = await Event.findById(id)
        if (!event) 
            return res.status(404).send({ status: 'error', msg: 'Event not found' })

        await Event.findByIdAndDelete(id)

        // Send cancellation email
        await transporter.sendMail({
            from: process.env.ADMIN_EMAIL,
            to: event.contactEmail,
            subject: `Event Cancelled: ${event.title}`,
            text: `Dear Member,\n\nWe regret to inform you that the event "${event.title}" has been cancelled.\n\nSorry for the inconvenience.\n\nThank you.`
        })

        res.status(200).send({ status: 'ok', msg: 'Event cancelled successfully' })
    } catch (e) {
        console.error('Error cancelling event:', e)
        res.status(500).send({ status: 'error', msg: 'Failed to cancel event' })
    }
})

module.exports = router