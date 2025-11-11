const express = require("express")
const router = express.Router()

const dotenv = require("dotenv");
dotenv.config()

const Guest = require('../../models/guest')
const verifyToken = require('../../middleware/verifyToken')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


// View all guests (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
   if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const guests = await Guest.find().sort({ timestamp: -1 })
        if (guests.length === 0) return res.status(200).send({ status: "ok", msg: "No guests found" })

        return res.status(200).send({ status: "ok", msg: 'success', count: guests.length, guests })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View single guest (Staff can view only if assigned)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const guest = await Guest.findById(id)
        if (!guest) return res.status(404).send({ status: 'error', msg: 'Guest not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', guest })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Search for guests
router.post("/search", async (req, res) => {
    const { name} = req.body

    if (!name) {
        return res.status(400).send({status:'error', msg: 'Name is required'})
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Find the guests
        const guests = await Guest.find({
            name: { $regex: name, $options: "i" }
        }).sort({date_added: -1})

        if (!guests || guests.length === 0) {
            return res.status(200).send({ status: 'ok', msg: "No guests found", count: 0, guests: [] })
        }

        return res.status(200).send({status: 'ok', msg: 'success', count: guests.length, guests})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// Block guest account
router.post('/block', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id, block_reason } = req.body
        if (!id || !block_reason ) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        const blocked = await Guest.findOneAndUpdate({ _id: id }, { is_blocked: true }, { new: true })
        if (!blocked) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', blocked })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Unblock guest account
router.post('/unblock', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id } = req.body
        if (!id ) {
            return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })
        }

        const unblocked = await Guest.findOneAndUpdate({ _id: id }, { is_blocked: false }, { new: true }
        )

        if (!unblocked) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', unblocked })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all blocked guests
router.post('/blocked', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        // Fetch all blocked guest accounts
        const blocked = await Guest.find({ is_blocked: true })
            .select('-password').lean()

        if (blocked.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No blocked guests found', blocked: [] })
        }

        res.status(200).send({ status: 'ok', msg: 'success', count: blocked.length, blocked })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Ban guest account
router.post('/ban', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id, ban_reason } = req.body
        if (!id || !ban_reason) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        const banned = await Guest.findOneAndUpdate({ _id: id }, { is_banned: true }, { new: true })
        if (!banned) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', banned })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Unban a guest account
router.post('/unban', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id } = req.body
        if (!id ) {
            return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })
        }

        const unbanned = await Guest.findOneAndUpdate({ _id: id }, { is_banned: false }, { new: true }
        )

        if (!unbanned) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', unbanned })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all banned guests
router.post('/banned', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        // Fetch all blocked guest accounts
        const banned = await Guest.find({ is_banned: true })
            .select('-password').lean()

        if (banned.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No banned guests found', banned: [] })
        }

        res.status(200).send({ status: 'ok', msg: 'success', count: banned.length, banned })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Delete guests account
router.post('/delete', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })
        }

        const deleted = await Guest.findOneAndDelete({ id })
        if (!deleted) {
            return res.status(404).send({ status: 'error', msg: 'guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


module.exports = router