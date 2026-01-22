const express = require("express")
const router = express.Router()

const dotenv = require("dotenv");
dotenv.config()

const Guest = require('../../models/guest')
const Booking = require('../../models/booking')
const verifyToken = require('../../middleware/verifyToken')


// Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// Get guest statistics
router.post("/stats", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const totalGuests = await Guest.countDocuments({ is_deleted: false })
        const activeGuests = await Guest.countDocuments({ status: "Active", is_deleted: false })
        const suspendedGuests = await Guest.countDocuments({ status: "Suspended", is_deleted: false })
        const formerGuests = await Guest.countDocuments({ status: "Deactivated", is_deleted: false })

        // Online Sign-ups: Guests who have set a password (registered online)
        const onlineSignUps = await Guest.countDocuments({ password: { $exists: true, $ne: "" }, is_deleted: false })

        // Retainment Rate Calculation
        const bookingsByGuest = await Booking.aggregate([
            { $group: { _id: "$guest", count: { $sum: 1 } } }
        ])
        const repeatGuests = bookingsByGuest.filter(g => g.count > 1).length
        const totalGuestsWithBookings = bookingsByGuest.length
        const retainmentRate = totalGuestsWithBookings > 0
            ? Math.round((repeatGuests / totalGuestsWithBookings) * 100)
            : 0

        res.status(200).send({
            status: "ok",
            msg: "success",
            stats: {
                total: totalGuests,
                active: activeGuests,
                former: formerGuests, // Used for Deactivated count if needed, or just general stats
                online_signups: onlineSignUps,
                suspended: suspendedGuests,
                retainmentRate: `${retainmentRate}%`
            }
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Add new guest
router.post("/add", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    const { fullname, email, phone_no, gender, address, date_of_birth } = req.body
    if (!fullname || !email || !phone_no) {
        return res.status(400).send({ status: 'error', msg: 'Fullname, email and phone number are required' })
    }

    try {
        const existing = await Guest.findOne({ email })
        if (existing) return res.status(400).send({ status: 'error', msg: 'Guest with this email already exists' })

        const guest = new Guest({
            fullname,
            email,
            phone_no,
            gender,
            address,
            date_of_birth,
            timestamp: Date.now()
        })
        await guest.save()
        res.status(200).send({ status: 'ok', msg: 'Guest added successfully', guest })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Update guest
router.post("/update", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    const { id, fullname, email, phone_no, gender, address, date_of_birth, status } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })

    try {
        const guest = await Guest.findById(id)
        if (!guest) return res.status(404).send({ status: 'error', msg: 'Guest not found' })

        guest.fullname = fullname || guest.fullname
        guest.email = email || guest.email
        guest.phone_no = phone_no || guest.phone_no
        guest.gender = gender || guest.gender
        guest.address = address || guest.address
        guest.date_of_birth = date_of_birth || guest.date_of_birth
        guest.status = status || guest.status
        guest.updatedAt = Date.now()

        await guest.save()
        res.status(200).send({ status: 'ok', msg: 'Guest updated successfully', guest })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all guests (with Pagination)
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    const { page = 1, limit = 20, startDate, endDate } = req.body
    try {
        let query = { is_deleted: false }

        // Date Filtering
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const count = await Guest.countDocuments(query)
        const guests = await Guest.find(query)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        return res.status(200).send({
            status: "ok",
            msg: 'success',
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            guests
        })

    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View single guest
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
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Search for guests (with Pagination)
router.post("/search", verifyToken, async (req, res) => {
    const { query, page = 1, limit = 20, startDate, endDate } = req.body

    if (!query) {
        return res.status(400).send({ status: 'error', msg: 'Search query is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const searchRegex = { $regex: query, $options: "i" }
        let baseQuery = {
            $or: [
                { fullname: searchRegex },
                { email: searchRegex },
                { phone_no: searchRegex }
            ],
            is_deleted: false
        }

        // Date Filtering
        if (startDate || endDate) {
            baseQuery.createdAt = {};
            if (startDate) baseQuery.createdAt.$gte = new Date(startDate);
            if (endDate) baseQuery.createdAt.$lte = new Date(endDate);
        }

        const count = await Guest.countDocuments(baseQuery)
        const guests = await Guest.find(baseQuery)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            guests
        })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Export guests to CSV
router.get("/export", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const guests = await Guest.find({ is_deleted: false }).lean()
        let csv = "Fullname,Email,Phone,Gender,Status,Joined\n"
        guests.forEach(g => {
            csv += `${g.fullname},${g.email},${g.phone_no},${g.gender},${g.status},${new Date(g.createdAt).toLocaleDateString()}\n`
        })

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=guests.csv')
        res.status(200).send(csv)
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Export failed", error: e.message })
    }
})


// Block guest account
router.post('/block', verifyToken, async (req, res) => {
    try {
        if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'guest')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
        }

        const { id, block_reason } = req.body
        if (!id || !block_reason) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        const blocked = await Guest.findOneAndUpdate({ _id: id }, { is_blocked: true, block_reason: block_reason }, { new: true })
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
        if (!id) {
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

        const banned = await Guest.findOneAndUpdate({ _id: id }, { is_banned: true, ban_reason: ban_reason }, { new: true })
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
        if (!id) {
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

        const { id, reason } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Guest ID is required' })
        }

        const deleted = await Guest.findOneAndUpdate({ _id: id }, { is_deleted: true, deletionReason: reason || null }, { new: true })
        if (!deleted) {
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


module.exports = router