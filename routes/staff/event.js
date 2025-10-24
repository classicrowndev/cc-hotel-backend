const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const jwt = require('jsonwebtoken')
const Event = require('../models/event')

// -----------------------------
// Staff Event Management Routes
// -----------------------------

/**
 * Add new event
 * Required: token, name, price, date, location
 * Optional: description, image, status
 */
router.post('/add', async (req, res) => {
    const { token, name, description, price, date, location, image, status } = req.body

    if (!token || !name || !price || !date || !location) {
        return res.status(400).send({ status: 'error', msg: 'Token, name, price, date and location are required' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // create new event document
        const event = new Event({
            name,
            description,
            price,
            date,
            location,
            image: image || '',
            availablility: true,
            status: status || 'Booked',
            timestamp: Date.now()
        })

        await event.save()
        return res.status(200).send({ status: 'success', msg: 'Event added successfully', event })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error adding event', error: e.message })
    }
})


// View all events
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) return res.status(400).send({ status: 'error', msg: 'Token must be provided' })

        try {
            // verify the staff's token
            jwt.verify(token, process.env.JWT_SECRET)

            // fetch all events
            const events = await Event.find().sort({ timestamp: -1 })
            if (!events.length) {
                return res.status(200).send({ status: 'ok', msg: 'No events found' })
            }
    
            return res.status(200).send({ status: 'success', events })
        } catch (e) {
            if (e.name === 'JsonWebTokenError') {
                return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        } 
        return res.status(500).send({ status: 'error', msg: 'Error fetching events', error: e.message })
    }
})


// View single event
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event id are required' })
    }
  
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
        
        // fetch the event
        const event = await Event.findById(id)
        if (!event) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }
        
        return res.status(200).send({ status: 'success', event })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }return res.status(500).send({ status: 'error', msg: 'Error fetching event', error: e.message })
    }
})


// Update event
router.post('/update', async (req, res) => {
    const { token, id, name, description, price, date, location, image, status } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event id are required' })
    }

    try {
         // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        const update = {}
        if (name !== undefined) update.name = name
        if (description !== undefined) update.description = description
        if (price !== undefined) update.price = price
        if (date !== undefined) update.date = date
        if (location !== undefined) update.location = location
        if (image !== undefined) update.image = image
        if (status !== undefined) update.status = status
            
        update.timestamp = Date.now()
            
        // check if the event exists
        const updated = await Event.findByIdAndUpdate(id, update, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Event not found' })
        }
        
        return res.status(200).send({ status: 'success', msg: 'Event updated successfully', event: updated })

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating event', error: e.message })
    }
})

// Update event status (Booked, In Progress, Completed, Cancelled, Overdue)
router.post('/update-status', async (req, res) => {
    const { token, id, status } = req.body

    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, event id and status are required' })
    }
  
    const validStatuses = ["Booked", "In Progress", "Completed", "Cancelled", "Overdue"]
    if (!validStatuses.includes(status)) {
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided' })
    }
    
    
    try {
        // verify's staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // fetch the event or events
        const updated = await Event.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(400).send({ status: 'error', msg: 'Event not found' })
        }

        return res.status(200).send({ status: 'success', msg: `Event status updated to ${status}`, event: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating event status', error: e.message })
    }
})

// Delete event
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and event id are required' })
    }
    
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // fetch the event record
        const deleted = await Event.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(400).send({ status: 'error', msg: 'Event not found or already deleted' })
        }
        
        return res.status(200).send({ status: 'success', msg: 'Event deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error deleting event', error: e.message })
    }
})


// Search events by name or location
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body
    if (!token || !keyword) {
        return res.status(400).send({ status: 'error', msg: 'Token and keyword are required' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
        
        // fetch the events
        const events = await Event.find({ $or: [{ name: { $regex: keyword, $options: 'i' } },
            { location: { $regex: keyword, $options: 'i' } }],
        }).sort({ timestamp: -1 })

        if (!events.length) {
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


// Filter events by status
router.post('/filter', async (req, res) => {
    const { token, status } = req.body
    if (!token || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token and status are required' })
    }
    
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // fetch all events
        const events = await Event.find({ status }).sort({ timestamp: -1 })
        if (!events.length) {
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


// Overview (summary)
router.post('/overview', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
        
        // fetch the status of events
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
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching overview', error: e.message })
    }
})

module.exports = router