const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Dish = require('../../models/dish')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


// -----------------------------
// Staff Dish Management Routes
// -----------------------------


// Add new dish (Owner/Admin only)
router.post('/add', verifyToken, async (req, res) => {
    const { name, category, amount_per_portion, status, quantity, image } = req.body
    if (!name || !category || amount_per_portion === undefined) {
        return res.status(400).send({ status: 'error', msg: 'Name, category and amount_per_portion are required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new dish.' })
    }

    try {
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
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }
    
    try {
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
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
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
router.post('/update', verifyToken, async (req, res) => {
    const { id, ...updateData } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update dish details.' })
    }


    try {
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
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can delete dish.' })
    }


    try {
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
router.post('/update_status', verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID and status are required' })
    }

    if (!['Available', 'Unavailable'].includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
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
router.post('/overview', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
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
router.post('/search', verifyToken, async (req, res) => {
    const { keyword } = req.body
    if (!keyword) {
        return res.status(400).send({ status: 'error', msg: 'Keyword is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
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