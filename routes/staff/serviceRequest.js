const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const ServiceRequest = require("../../models/serviceRequest")
const Service = require("../../models/service")


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// Fetch all service requests (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
    const { search, date } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        let query = {}

        // Date Filtering
        if (date) {
            const now = new Date()
            let startDate

            if (date === 'Today') {
                startDate = new Date(now.setHours(0, 0, 0, 0))
            } else if (date === 'This Week') {
                const firstDay = now.getDate() - now.getDay()
                startDate = new Date(now.setDate(firstDay))
                startDate.setHours(0, 0, 0, 0)
            } else if (date === 'This Month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            } else if (date === 'This Year') {
                startDate = new Date(now.getFullYear(), 0, 1)
            }

            if (startDate) {
                query.request_date = { $gte: startDate }
            }
        }

        // Search logic
        if (search) {
            const Guest = require('../../models/guest')
            const searchRegex = new RegExp(search, 'i')

            // Find guests matching search name
            const guests = await Guest.find({ fullname: searchRegex }).select('_id')
            const guestIds = guests.map(g => g._id)

            // Allow search by Guest Name OR Request ID
            query.$or = [
                { guest: { $in: guestIds } }
            ]

            // If query is a valid ObjectId, search by request _id too
            const mongoose = require('mongoose')
            if (mongoose.Types.ObjectId.isValid(search)) {
                query.$or.push({ _id: search })
            }
        }

        const requests = await ServiceRequest.find(query)
            .populate("guest", "fullname email")
            .populate("service", "name service_type")
            .sort({ request_date: -1 })

        if (requests.length === 0) {
            return res.status(200).send({ status: "ok", msg: "No service requests found" })
        }

        return res.status(200).send({ status: "ok", msg: 'success', count: requests.length, requests })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View a specific service request (Owner/Admin or Assigned Staff)
router.post("/view", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Request ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const request = await ServiceRequest.findById(id).populate("guest", "fullname email")
            .populate("service", "name service_type")

        if (!request) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: 'success', request })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update request status (Owner/Admin or Assigned Staff)
router.post("/update_status", verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status) {
        return res.status(400).send({ status: "error", msg: "Request ID and status are required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const updated = await ServiceRequest.findByIdAndUpdate(id, { status }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: "success", updated })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Delete a service request (Owner/Admin or Assigned Staff)
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Request ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const deleted = await ServiceRequest.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: "success", deleted })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View Other Services Stats (Owner/Admin)
router.post("/stats", verifyToken, async (req, res) => {
    // Check role access - same as 'all' or 'view'
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        // 1. Total Bookings
        const totalBookings = await ServiceRequest.countDocuments()

        // 2. Online vs Direct Counts
        // "Online" = Guest has a password
        // "Direct" = Guest does not have a password
        // Fetch all requests with guest info to categorize
        const requestsWithGuest = await ServiceRequest.find()
            .select('guest')
            .populate('guest', 'password')
            .lean()

        let onlineCount = 0
        let directCount = 0

        requestsWithGuest.forEach(req => {
            if (req.guest && req.guest.password) {
                onlineCount++
            } else {
                directCount++
            }
        })

        // 3. Total Services (Total distinct services available in the system)
        const totalServices = await Service.countDocuments()

        // 4. On-going vs Completed
        // "On-going" = Status is NOT 'Completed' or 'Cancelled' (so Pending, In Progress, etc.)
        // "Completed" = Status is 'Completed'

        const completedCount = await ServiceRequest.countDocuments({ status: 'Completed' })

        // Assuming anything not completed or cancelled is "On-going"
        // Adjust statuses as per actual enum if known. For now, matching standard logic.
        const ongoingCount = await ServiceRequest.countDocuments({
            status: { $nin: ['Completed', 'Cancelled'] }
        })

        return res.status(200).send({
            status: "ok",
            msg: "success",
            data: {
                totalBookings,
                onlineBookings: onlineCount,
                directBookings: directCount,
                totalServices,
                ongoing: ongoingCount,
                completed: completedCount
            }
        })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})



// Create a new service request (Admin/Owner/Staff)
router.post("/add", verifyToken, async (req, res) => {
    const {
        guest_id, first_name, last_name, email, phone, // Guest Params
        service_id, amount, room, // Basic Request Params
        duration, delivery_date, payment_method // New Modal Params
    } = req.body

    if (!service_id || !amount) {
        return res.status(400).send({ status: "error", msg: "Service ID and Amount are required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const Service = require('../../models/service')
        const serviceExists = await Service.findById(service_id)
        if (!serviceExists) return res.status(404).send({ status: "error", msg: "Service not found" })

        // Guest Logic
        const Guest = require('../../models/guest')
        let targetGuestId = guest_id

        // If guest_id is not provided, try to find or create guest using email
        if (!targetGuestId) {
            if (!email || !first_name || !last_name || !phone) {
                return res.status(400).send({ status: "error", msg: "Guest details (Name, Email, Phone) are required if Guest ID is missing." })
            }

            let existingGuest = await Guest.findOne({ email })
            if (existingGuest) {
                targetGuestId = existingGuest._id
            } else {
                // Create new guest
                const password = Math.random().toString(36).slice(-8) // Generate random password
                // Hash password if your Guest model requires it, but for now assuming plain or handled by pre-save (if exists). 
                // NOTE: In a real app, you should hash this. Assuming existing auth flow handles login later.

                const newGuest = new Guest({
                    fullname: `${first_name} ${last_name}`,
                    email,
                    phone_no: phone,
                    password: password, // You might want to hash this
                    status: 'Active',
                    timestamp: Date.now()
                })
                await newGuest.save()
                targetGuestId = newGuest._id
            }
        } else {
            const guestExists = await Guest.findById(targetGuestId)
            if (!guestExists) return res.status(404).send({ status: "error", msg: "Guest not found" })
            // Use existing guest email/info
        }

        // Determine payment status
        const paymentStatus = (payment_method && payment_method !== 'N/A') ? 'Paid' : 'Pending'

        const newRequest = new ServiceRequest({
            guest: targetGuestId,
            email: email, // Should match guest email
            service: service_id,
            room: room || "N/A",
            amount: amount,
            duration: duration,
            delivery_date: delivery_date,
            payment_method: payment_method || 'N/A',
            payment_status: paymentStatus,
            status: "Pending",
            timestamp: Date.now()
        })

        await newRequest.save()
        return res.status(200).send({ status: "ok", msg: "success", newRequest })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Export service requests to CSV (Owner/Admin/Staff)
router.post("/export", verifyToken, async (req, res) => {
    const { search, date } = req.body // Support same filters as /all

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        let query = {}

        // Reusing filter logic (ideally refactor to helper function)
        if (date) {
            const now = new Date()
            let startDate
            if (date === 'Today') startDate = new Date(now.setHours(0, 0, 0, 0))
            else if (date === 'This Week') {
                const firstDay = now.getDate() - now.getDay()
                startDate = new Date(now.setDate(firstDay))
                startDate.setHours(0, 0, 0, 0)
            } else if (date === 'This Month') startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            else if (date === 'This Year') startDate = new Date(now.getFullYear(), 0, 1)

            if (startDate) query.request_date = { $gte: startDate }
        }

        if (search) {
            const Guest = require('../../models/guest')
            const guests = await Guest.find({ fullname: new RegExp(search, 'i') }).select('_id')
            const guestIds = guests.map(g => g._id)
            query.$or = [{ guest: { $in: guestIds } }]
            const mongoose = require('mongoose')
            if (mongoose.Types.ObjectId.isValid(search)) query.$or.push({ _id: search })
        }

        const requests = await ServiceRequest.find(query)
            .populate("guest", "fullname email")
            .populate("service", "name service_type")
            .sort({ request_date: -1 })
            .lean()

        // Generate CSV
        const fields = ['Order ID', 'Guest Name', 'Service Type', 'Amount', 'Status', 'Date']
        let csv = fields.join(',') + '\n'

        requests.forEach(req => {
            const row = [
                req._id,
                req.guest ? `"${req.guest.fullname}"` : "Unknown",
                req.service ? req.service.name : "N/A",
                req.amount,
                req.status,
                req.request_date ? new Date(req.request_date).toISOString().split('T')[0] : ""
            ]
            csv += row.join(',') + '\n'
        })

        res.header('Content-Type', 'text/csv')
        res.attachment('bookings.csv')
        return res.send(csv)

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


module.exports = router