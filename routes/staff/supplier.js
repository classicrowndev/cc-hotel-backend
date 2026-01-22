const express = require('express')
const router = express.Router()
const Supplier = require('../../models/supplier')
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

// Get supplier statistics
router.post("/stats", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const total = await Supplier.countDocuments()
        res.status(200).send({ status: "ok", msg: "success", stats: { total } })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View all suppliers (with Pagination)
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    const { page = 1, limit = 20, startDate, endDate } = req.body
    try {
        const query = {}

        // Date Filtering
        if (startDate || endDate) {
            query.createdAt = {}
            if (startDate) query.createdAt.$gte = new Date(startDate)
            if (endDate) query.createdAt.$lte = new Date(endDate)
        }

        const count = await Supplier.countDocuments(query)
        const suppliers = await Supplier.find(query)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            suppliers
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Add new supplier
router.post("/add", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add suppliers.' })
    }

    const { name, phone_no, email, office_address, country, category } = req.body
    if (!name || !phone_no) {
        return res.status(400).send({ status: 'error', msg: 'Name and phone number are required' })
    }

    try {
        const supplier = new Supplier({
            name,
            phone_no,
            email,
            office_address,
            country,
            category,
            timestamp: Date.now()
        })
        await supplier.save()
        res.status(200).send({ status: 'ok', msg: 'success', supplier })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Update supplier
router.post("/update", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    const { id, name, phone_no, email, office_address, country, category, status, last_supply, total_supply } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Supplier ID is required' })

    try {
        const supplier = await Supplier.findById(id)
        if (!supplier) return res.status(404).send({ status: 'error', msg: 'Supplier not found' })

        supplier.name = name || supplier.name
        supplier.phone_no = phone_no || supplier.phone_no
        supplier.email = email || supplier.email
        supplier.country = country || supplier.country
        supplier.office_address = office_address || supplier.office_address
        supplier.category = category || supplier.category
        supplier.status = status || supplier.status
        supplier.last_supply = last_supply || supplier.last_supply
        supplier.total_supply = total_supply !== undefined ? total_supply : supplier.total_supply

        await supplier.save()
        res.status(200).send({ status: 'ok', msg: 'Supplier updated successfully', supplier })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Delete supplier
router.post("/delete", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Supplier ID is required' })

    try {
        const deleted = await Supplier.findByIdAndDelete(id)
        if (!deleted) return res.status(404).send({ status: 'error', msg: 'Supplier not found' })

        res.status(200).send({ status: 'ok', msg: 'Supplier deleted successfully' })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Search supplier (with Pagination)
router.post("/search", verifyToken, async (req, res) => {
    const { query, page = 1, limit = 20, startDate, endDate } = req.body
    if (!query) return res.status(400).send({ status: 'error', msg: 'Search query is required' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const searchRegex = { $regex: query, $options: "i" }
        const baseQuery = {
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone_no: searchRegex },
                { category: searchRegex }
            ]
        }

        // Date Filtering
        if (startDate || endDate) {
            baseQuery.createdAt = {}
            if (startDate) baseQuery.createdAt.$gte = new Date(startDate)
            if (endDate) baseQuery.createdAt.$lte = new Date(endDate)
        }

        const count = await Supplier.countDocuments(baseQuery)
        const suppliers = await Supplier.find(baseQuery)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            suppliers
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Export suppliers to CSV
router.get("/export", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const suppliers = await Supplier.find().lean()
        let csv = "Name,Phone,Email,Address,Country,Category,Last Supply,Total Supply,Updated,Status\n"
        suppliers.forEach(s => {
            const lastUpdate = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : 'N/A'
            csv += `${s.name},${s.phone_no},${s.email},"${s.office_address}",${s.country || 'N/A'},${s.category},${s.last_supply ? new Date(s.last_supply).toLocaleDateString() : 'N/A'},${s.total_supply},${lastUpdate},${s.status}\n`
        })

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=suppliers.csv')
        res.status(200).send(csv)
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Export failed", error: e.message })
    }
})

module.exports = router