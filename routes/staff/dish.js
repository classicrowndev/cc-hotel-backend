const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Dish = require('../models/dish')

// -----------------------------
// Staff Dish Management Routes
// -----------------------------

/**
 * Add a new dish (staff)
 * Required in body: token, name, category, amount_per_portion
 * Optional: status, quantity, image
 */
router.post('/add', async (req, res) => {
    const { token, name, category, amount_per_portion, status, quantity, image } = req.body

    if (!token || !name || !category || amount_per_portion === undefined) {
        return res.status(400).send({ status: 'error', msg: 'Token, name, category and amount_per_portion are required' })
    }
    
    try {
        //verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

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
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error adding dish', error: e.message })
    }
})


// View all dishes (staff)
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the staff's token
            
        jwt.verify(token, process.env.JWT_SECRET)

        // Fetch all dishes
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


// View single dish (staff)
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id are required' })
    }

    try {
        // verify's the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // Fetch the dish
        const dish = await Dish.findById(id)
        if (!dish) {
            return res.status(400).send({ status: 'error', msg: 'Dish not found' })
        }
        
        return res.status(200).send({ status: 'success', dish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching dish', error: e.message })
    }
})


// Update dish (staff)
router.post('/update', async (req, res) => {
    const { token, id, name, category, status, quantity, amount_per_portion, image } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id are required' })
    }
    
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        
        const update = {}
        if (name !== undefined) update.name = name
        if (category !== undefined) update.category = category
        if (status !== undefined) update.status = status
        if (quantity !== undefined) update.quantity = quantity
        if (amount_per_portion !== undefined) update.amount_per_portion = amount_per_portion
        if (image !== undefined) update.image = image
        update.timestamp = Date.now()

        const updatedDish = await Dish.findByIdAndUpdate(id, update, { new: true })
        if (!updatedDish) {
            return res.status(400).send({ status: 'error', msg: 'Dish not found' })
        }
        
        return res.status(200).send({ status: 'success', msg: 'Dish updated successfully', dish: updatedDish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating dish', error: e.message })
  }
})


//  Delete dish (staff)
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and dish id are required' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // Fetch the dish
        const deleted = await Dish.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(400).send({ status: 'error', msg: 'Dish not found or already deleted' })
        }
        
        return res.status(200).send({ status: 'success', msg: 'Dish deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error deleting dish', error: e.message })
    }
})


// Update dish status (Available / Unavailable) (staff)
router.post('/update-status', async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, dish id and status are required' })
    }
  
    if (!['Available', 'Unavailable'].includes(status)) {
        return res.status(400).send({ status: 'error', msg: 'Invalid status. Use "Available" or "Unavailable"' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        const updated = await Dish.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(400).send({ status: 'error', msg: 'Dish not found' })
        }

        return res.status(200).send({ status: 'success', msg: `Dish status updated to ${status}`, dish: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating dish status', error: e.message })
    }
})


// Overview (staff) - analytics: total dishes, available, unavailable, total drinks (simple)
router.post('/overview', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // Fetch all dishes' status
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


// Search dishes (staff)
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body
    if (!token || !keyword) {
        return res.status(400).send({ status: 'error', msg: 'Token and keyword are required' })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        const dishes = await Dish.find({$or: [{ name: { $regex: keyword, $options: 'i' } },
            { category: { $regex: keyword, $options: 'i' } }]
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