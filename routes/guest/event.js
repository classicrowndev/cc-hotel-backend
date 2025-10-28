const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const jwt = require('jsonwebtoken')
const nodemailer = require("nodemailer");
const Event = require('../../models/event')


// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
})

// Reserve or register for an event
router.post('/reserve', async (req, res) => {
    const { token, name, description, price, date, location, image } = req.body

    if (!token || !name || !price || !date || !location) {
        return res.status(400).send({ status: 'error', msg: 'Token and all required fields must be provided' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Book for a new event
        const newEventBooking = new Event({
            name,
            description,
            price,
            date,
            location,
            availablility: true,
            status: "Booked",
            image,
            timestamp: Date.now(),
        })

        await newEventBooking.save()

        // Send confirmation email
        const mailOptions = {
            from: `"Hotel Events" <${process.env.EMAIL_USER}>`,
            to: guest.email,
            subject: "Event Reservation Confirmation",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Reservation Confirmed 🎉</h2>
                    <p>Dear Guest,</p>
                    <p>Your reservation for <b>${name}</b> has been successfully confirmed.</p>
                    <ul>
                        <li><b>Date:</b> ${new Date(date).toDateString()}</li>
                        <li><b>Location:</b> ${location}</li>
                        <li><b>Price:</b> ₦${price}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>We look forward to seeing you at the event!</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Events Team</p>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        return res.status(201).send({
            status: 'success',
            msg: 'Event reserved successfully, confirmation email sent',
            booking: newEventBooking,
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error reserving event', error: e.message })
    }
})


// View all available events
router.post('/all', async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the guest's token
        jwt.verify(token, process.env.JWT_SECRET)

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
router.post('/view', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event ID are required' })
    }

    try {
        // verify the guest's token
        jwt.verify(token, process.env.JWT_SECRET)

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
router.post('/filter', async (req, res) => {
    const { token, status } = req.body

    if (!token || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token and status are required' })
    }

    try {
        // verify the guest's token
        jwt.verify(token, process.env.JWT_SECRET)

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
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body

    if (!token || !keyword) {
        return res.status(400).send({ status: 'error', msg: 'Token and keyword are required' })
    }

    try {
        // verify the guest's token
        jwt.verify(token, process.env.JWT_SECRET)

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
router.post('/cancel', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event ID are required' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the event
        const event = await Event.findById(id)
        if (!event) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }

        event.status = "Cancelled"
        await event.save()

        // Send cancellation email
        const mailOptions = {
            from: `"Hotel Events" <${process.env.EMAIL_USER}>`,
            to: guest.email,
            subject: "Event Reservation Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Reservation Cancelled ❌</h2>
                    <p>Dear Guest,</p>
                    <p>Your reservation for <b>${event.name}</b> scheduled on <b>${new Date(event.date).toDateString()}</b> has been successfully cancelled.</p>
                    <p>If this was a mistake, please rebook anytime through our events page.</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Events Team</p>
                </div>
            `,
        }

        await transporter.sendMail(mailOptions)

        return res.status(200).send({ status: 'success', msg: 'Event cancelled successfully, confirmation email sent' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling event', error: e.message })
    }
})

module.exports = router
