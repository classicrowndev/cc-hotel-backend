const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Dish = require('../../models/dish')


// -----------------------------
// Staff Dish Management Routes
// -----------------------------


// Add new dish (Owner/Admin only)
router.post('/add', async (req, res) => {
    const { token, name, category, amount_per_portion, status, quantity, image } = req.body
    if (!token || !name || !category || amount_per_portion === undefined) {
        return res.status(400).send({ status: 'error', msg: 'Token, name, category and amount_per_portion are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add dishes.' })
        }

        const dish = new Dish({
            name,
            category,
            status: status || 'Available',
            quantity: quantity ?? 0,
            amount_per_portion,
            image: image || '',
            date_added: Date.now(),
            timestamp: Date.now()
        })

        await dish.save()
        return res.status(200).send({ status: 'success', msg: 'Dish added successfully', dish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        return res.status(500).send({ status: 'error', msg: 'Error adding dish', error: e.message })
    }
})


// Staff can only view dishes or take orders
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) return res.status(400).send({ status: 'error', msg: 'Token must be provided' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Staff must be assigned to "dish" task
        if (decoded.role === 'Staff' && decoded.task !== 'dish') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to dish operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const dishes = await Dish.find().sort({ date_added: -1 })
        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes found' })
        }

        return res.status(200).send({ status: 'success', count: dishes.length, dishes })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching dishes', error: e.message })
    }
})


// View single dish (Staff can view only if assigned)
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (decoded.role === 'Staff' && decoded.task !== 'dish') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to dish operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const dish = await Dish.findById(id)
        if (!dish) return res.status(404).send({ status: 'error', msg: 'Dish not found' })

        return res.status(200).send({ status: 'success', dish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching dish', error: e.message })
    }
})


// Update dish (Owner/Admin only)
router.post('/update', async (req, res) => {
    const { token, id, ...updateData } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Only Owner/Admin can update dishes.' })
        }

        updateData.timestamp = Date.now()
        const updatedDish = await Dish.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedDish) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Dish updated successfully', dish: updatedDish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating dish', error: e.message })
    }
})


// Delete dish (Owner/Admin only)
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Only Owner/Admin can delete dishes.' })
        }

        const deleted = await Dish.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found or already deleted' })
        }

        return res.status(200).send({ status: 'success', msg: 'Dish deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error deleting dish', error: e.message })
    }
})


// Update dish status (Owner/Admin or Assigned Staff)
router.post('/update_status', async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, dish id and status required' })
    }

    if (!['Available', 'Unavailable'].includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'dish') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to dish operations' })
        }

        if (!['Owner', 'Admin', 'Staff'].includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role' })
        }

        const updated = await Dish.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found' })
        }

        return res.status(200).send({ status: 'success', msg: `Dish status updated to ${status}`, dish: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating dish status', error: e.message })
    }
})

// Overview (Staff can view if assigned, otherwise Owner/Admin)
router.post('/overview', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'dish') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to dish operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const total = await Dish.countDocuments()
        const available = await Dish.countDocuments({ status: 'Available' })
        const unavailable = await Dish.countDocuments({ status: 'Unavailable' })
        const total_drinks = await Dish.countDocuments({ category: { $in: ['Bar & Drinks', 'Beverages'] } })

        return res.status(200).send({ status: 'success', overview: { total, available, unavailable, total_drinks }})
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching overview', error: e.message })
    }
})


//Search (Staff can view if assigned, otherwise Owner/Admin)
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body
    if (!token || !keyword) {
        return res.status(400).send({ status: 'error', msg: 'Token and keyword required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'dish') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to dish operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const dishes = await Dish.find({
            $or: [{ name: { $regex: keyword, $options: 'i' } }, { category: { $regex: keyword, $options: 'i' } }]
        }).sort({ date_added: -1 })

        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes match your search' })
        }

        return res.status(200).send({ status: 'success', count: dishes.length, dishes })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error searching dishes', error: e.message })
    }
})

module.exports = router