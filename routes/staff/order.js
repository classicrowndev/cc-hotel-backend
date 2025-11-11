const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Order = require('../../models/order')
const Dish = require('../../models/dish')

//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
}


// ==========================================
// STAFF ORDER MANAGEMENT ROUTES
// ==========================================


// Add new order (Owner/Admin only)
router.post('/add', verifyToken, async (req, res) => {
    const { guest, email, dishes, room } = req.body
    if (!guest || !email || !dishes || !room ) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add orders.' })
    }

    try {
        if (!Array.isArray(dishes) || dishes.length === 0) {
            return res.status(400).send({ status: 'error', msg: 'Dishes must be provided as a non-empty array' })
        }

        let totalAmount = 0
        const orderDishes = []

        for (const item of dishes) {
            const foundDish = await Dish.findOne({ name: item.name, status: 'Available' })
            if (!foundDish) {
                return res.status(400).send({ status: 'error', msg: `Dish "${item.name}" not found or unavailable` })
            }

            const quantity = item.quantity || 1
            const price = foundDish.amount_per_portion * quantity
            totalAmount += price
            orderDishes.push({ name: foundDish.name, quantity, price })

            if (foundDish.quantity > 0) {
                foundDish.quantity -= quantity
                await foundDish.save()
            }
        }

        const newOrder = new Order({
            guest,
            email,
            dishes: orderDishes,
            room,
            amount: totalAmount,
            payment_method,
            order_date: new Date(),
            timestamp: Date.now()
        })

        await newOrder.save()
        return res.status(200).send({ status: 'ok', msg: 'success', order: newOrder })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all orders (Owner/Admin or assigned Staff)
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const orders = await Order.find().sort({ order_date: -1 })
        if (!orders.length) return res.status(200).send({ status: 'ok', msg: 'No orders found' })

        return res.status(200).send({ status: 'ok', msg: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View specific order (Owner/Admin or assigned Staff)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Order ID is required' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const order = await Order.findById(id)
        if (!order) return res.status(404).send({ status: 'error', msg: 'Order not found' })

        return res.status(200).send({ status: 'ok', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update order status (Owner/Admin or assigned Staff)
router.post('/update_status', verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status)
        return res.status(400).send({ status: 'error', msg: 'Order ID and status are required' })

    const validStatuses = ["Order Placed", "Preparing", "Served", "Delivered"]
    if (!validStatuses.includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid order status' })      

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const updatedOrder = await Order.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updatedOrder)
            return res.status(404).send({ status: 'error', msg: 'Order not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', order: updatedOrder })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete order (Owner/Admin only or assigned staff)
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Order ID is required' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }
    
    try {
        const deleted = await Order.findByIdAndDelete(id)
        if (!deleted)
            return res.status(404).send({ status: 'error', msg: 'Order not found or already deleted' })

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Filter (Owner/Admin or assigned staff)
router.post('/filter', verifyToken, async (req, res) => {
    const { status, startDate, endDate } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'order')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const query = {}

        if (status) query.status = status
        if (startDate && endDate) {
            query.order_date = { $gte: new Date(startDate), $lte: new Date(endDate) }
        }

        const orders = await Order.find(query).sort({ order_date: -1 })
        if (!orders.length)
            return res.status(200).send({ status: 'ok', msg: 'No orders found matching filter' })

        return res.status(200).send({ status: 'ok', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router