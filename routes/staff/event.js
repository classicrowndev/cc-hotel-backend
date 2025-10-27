const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const nodemailer = require('../utils/nodemailer')
const Event = require('../models/event')
const Staff = require('../models/staff')


// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})


// -----------------------------
// Staff Event Management Routes
// -----------------------------

// Add new event (Only Owner/Admin)
router.post('/add', async (req, res) => {
    const { token, name, description, price, date, location, image, status, email } = req.body
    if (!token || !name || !price || !date || !location) {
        return res.status(400).send({ status: 'error', msg: 'Token, name, price, date, and location are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!['Owner','Admin'].includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner or Admin can add new events.' })
        }

        const event = new Event({
            name,
            description,
            price,
            date,
            location,
            image: image || '',
            availability: true,
            status: status || 'Booked',
            timestamp: Date.now()
        })

        await event.save()


        // Send email to guest/attendee
        const mailOptions = {
            from: `"Event Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Event Added Successfully',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Created</h2>
                    <p>Dear Guest,</p>
                    <p>Your event <b>${name}</b> has been created successfully.</p>
                    <ul>
                        <li><b>Description:</b> ${description || 'N/A'}</li>
                        <li><b>Location:</b> ${location}</li>
                        <li><b>Price:</b> ₦${price}</li>
                        <li><b>Date:</b> ${new Date(date).toDateString()}</li>
                        <li><b>Status:</b> ${status || 'Booked'}</li>
                    </ul>
                    <p>Warm regards,<br/>The Event Management Team</p>
                </div>
            `
        }
        await transporter.sendMail(mailOptions)


        return res.status(200).send({ status: 'success', msg: 'Event added successfully', event })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error adding event', error: e.message })
    }
})


// View all events (Only assigned staff + Admin + Owner)
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const events = await Event.find().sort({ timestamp: -1 })
        if (!events.length) {
            return res.status(200).send({ status: 'ok', msg: 'No events found' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching events', error: e.message })
    }
})


// View single event (Only assigned staff + Admin + Manager)
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event ID are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const event = await Event.findById(id)
        if (!event) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }

        return res.status(200).send({ status: 'success', event })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching event', error: e.message })
    }
})


// Update event details (Optional: Assigned staff MAY be allowed if approved by client)
router.post('/update', async (req, res) => {
    const { token, id, email, ...updateData } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event ID are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
        // If the client approves assigned staff to update event details
        /*if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }
        */

        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ 
                status: 'error', msg: 'Access denied. Only Admin or Owner can update event details.'
            })
        }

        updateData.timestamp = Date.now()
        const updated = await Event.findByIdAndUpdate(id, updateData, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }


        // Only send email if email is provided
        if (email) {
            const mailOptions = {
                from: `"Event Management" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: updateData.status ? `Event Status Updated: ${updateData.status}` : 'Event Details Updated',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Event Updated</h2>
                        <p>Dear Guest,</p>
                        <p>Your event <b>${updated.name}</b> has been updated.</p>
                        ${updateData.status ? `<p>New status: <b>${updateData.status}</b></p>` : ''}
                        <p>Warm regards,<br/>The Event Management Team</p>
                    </div>
                `
            }
            await transporter.sendMail(mailOptions);
        }

        return res.status(200).send({ status: 'success', msg: 'Event updated successfully', event: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating event', error: e.message })
    }
})


// Update event status (Optional: Assigned staff MAY be allowed if approved)
router.post('/update_status', async (req, res) => {
    const { token, id, status } = req.body
    const validStatuses = ['Booked', 'In Progress', 'Completed', 'Cancelled', 'Overdue']

    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, event ID, and status are required' })
    }
    
    if (!validStatuses.includes(status)) {
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        // If the client approves assigned staff to update event status
        /*if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }
        */

        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ 
                status: 'error', msg: 'Access denied. Only Admin or Owner can update event status.' 
            })
        }

        const updated = await Event.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }

        return res.status(200).send({ status: 'success', msg: `Event status updated to ${status}`, event: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating status', error: e.message })
    }
})


// Cancel event (Only Admin or Owner)
router.post('/Cancel', async (req, res) => {
    const { token, id, email } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event ID are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can cancel events.' })
        }

        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        event.status = "Cancelled"
        await event.save()

        // Determine recipient email
        const recipientEmail = email || event.email;

        // Send cancellation email
        const mailOptions = {
            from: `"Event Management" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: 'Event Cancelled',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Cancelled</h2>
                    <p>Dear Guest,</p>
                    <p>Your event <b>${event.name}</b> has been cancelled by our management team.</p>
                    <p>If you believe this is a mistake, please contact the event administration.</p>
                    <br/>
                    <p>Warm regards,<br/>The Event Management Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)


        return res.status(200).send({ status: 'success', msg: 'Event cancelled successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling event', error: e.message })
    }
})


// Search events (Assigned staff + Admin + Manager)
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body
    if (!token || !keyword) return res.status(400).send({ status: 'error', msg: 'Token and keyword are required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const events = await Event.find({
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { location: { $regex: keyword, $options: 'i' } }
            ]
        }).sort({ timestamp: -1 })

        if (!events.length) {
            return res.status(200).send({ status: 'ok', msg: 'No matching events found' })
        }

        return res.status(200).send({ status: 'success', events })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error searching events', error: e.message })
    }
})


// Filter events by status (Assigned staff + Admin + Manager)
router.post('/filter', async (req, res) => {
    const { token, status } = req.body
    if (!token || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token and status are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const events = await Event.find({ status }).sort({ timestamp: -1 })
        if (!events.length) {
            return res.status(200).send({ status: 'ok', msg: 'No events found for this status' })
        }

        return res.status(200).send({ status: 'success', events })
        } catch (e) {
            if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error filtering events', error: e.message })
    }
})


// Overview (Assigned staff + Admin + Manager)
router.post('/overview', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'event') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to event operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const total = await Event.countDocuments()
        const booked = await Event.countDocuments({ status: 'Booked' })
        const inProgress = await Event.countDocuments({ status: 'In Progress' })
        const completed = await Event.countDocuments({ status: 'Completed' })
        const cancelled = await Event.countDocuments({ status: 'Cancelled' })
        const overdue = await Event.countDocuments({ status: 'Overdue' })

        return res.status(200).send({status: 'success', 
            overview: { total, booked, inProgress, completed, cancelled, overdue }
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching overview', error: e.message })
    }
})

module.exports = router