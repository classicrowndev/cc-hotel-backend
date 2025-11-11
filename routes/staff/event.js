const express = require('express')
const router = express.Router()
const dotenv = require('dotenv')
dotenv.config()

const Event = require('../../models/event')
const Hall = require('../../models/hall')
const Guest = require('../../models/guest')
const verifyToken = require('../../middleware/verifyToken')
const { sendGuestEventApprovalMail, sendGuestEventRejectionMail, 
    sendGuestEventCompletionMail } = require('../../utils/nodemailer')


// Role checker
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// VIEW ALL EVENTS (Owner/Admin/Staff)
router.post('/all', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'event')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const events = await Event.find()
            .populate('guest', 'fullname email')
            .populate('hall', 'name hall_type location')
            .sort({ timestamp: -1 })

        if (!events || events.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No events found.' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', events })
    } catch (e) {
        console.error('Error fetching events:', e);
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// VIEW SINGLE EVENT DETAILS (Owner/Admin/Staff)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'event')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const event = await Event.findById(id)
            .populate('guest', 'fullname email phone_no')
            .populate('hall', 'name hall_type location amount');

        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', event })
    } catch (e) {
        console.error('Error fetching event:', e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// APPROVE EVENT REQUEST (Owner/Admin/Staff)
router.post('/approve', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'event')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const event = await Event.findById(id).populate('guest').populate('hall')
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        if (event.status !== 'Pending') {
            return res.status(400).send({ status: 'error', msg: `Cannot approve an event with status '${event.status}'` })
        }

        event.status = 'Approved'
        await event.save()

        // Send approval mail to guest
        await sendGuestEventApprovalMail(
            event.guest.email,
            event.guest.fullname,
            event.date,
            event.total_price
        )

        return res.status(200).send({ status: 'ok', msg: 'success', event })
    } catch (e) {
        console.error('Error approving event:', e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// REJECT (DECLINE) EVENT REQUEST (Owner/Admin/Staff)
router.post('/reject', verifyToken, async (req, res) => {
    const { id, reason } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'event')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const event = await Event.findById(id).populate('guest').populate('hall')
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        if (['Approved', 'In Progress', 'Completed', 'Cancelled'].includes(event.status)) {
            return res.status(400).send({ status: 'error', msg: `Cannot reject an event that is already ${event.status}.` })
        }

        event.status = 'Rejected'
        await event.save()

        // Notify guest via email
        await sendGuestEventRejectionMail(
            event.guest.email,
            event.guest.fullname,
            event.event_name,
            reason || 'No reason provided.'
        )

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        console.error('Error rejecting event:', e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// MARK EVENT AS "IN PROGRESS"
router.post('/start', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'event')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        if (event.status !== 'Approved') {
            return res.status(400).send({ status: 'error', msg: `Only approved events can be started.` })
        }

        event.status = 'In Progress'
        await event.save()

        return res.status(200).send({ status: 'ok', msg: 'success', event })
    } catch (e) {
        console.error('Error updating event status:', e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// MARK EVENT AS "COMPLETED"
router.post('/complete', verifyToken, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send({ status: 'error', msg: 'Event ID is required' })

    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        const event = await Event.findById(id).populate('guest').populate('hall')
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        if (event.status !== 'In Progress') {
            return res.status(400).send({ status: 'error', msg: 'Only In Progress events can be marked as Completed.' })
        }

        event.status = 'Completed'
        await event.save()

        await sendGuestEventCompletionMail(
            event.guest.email,
            event.guest.fullname,
            event.hall_name,
            event.date
        )

        return res.status(200).send({ status: 'ok', msg: 'success', event })
    } catch (e) {
        console.error('Error completing event:', e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})

module.exports = router
