const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Order = require('../../models/order')
const Dish = require('../../models/dish')


// ==========================================
// STAFF ORDER MANAGEMENT ROUTES
// ==========================================


// Add new order (Owner/Admin only)
router.post('/add', async (req, res) => {
    const { token, guest, email, dishes, room, payment_method } = req.body
    if (!token || !guest || !email || !dishes || !room || !payment_method) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add orders.' })
        }

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
        return res.status(200).send({ status: 'success', msg: 'Order added successfully', order: newOrder })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error adding order', error: e.message })
    }
})


// View all orders (Owner/Admin or assigned Staff)
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token)
        return res.status(400).send({ status: 'error', msg: 'Token is required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Restrict staff to only those assigned to "order"
        if (decoded.role === 'Staff' && decoded.task !== 'order') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to order operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const orders = await Order.find().sort({ order_date: -1 })
        if (!orders.length) return res.status(200).send({ status: 'ok', msg: 'No orders found' })

        return res.status(200).send({ status: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error fetching orders', error: e.message })
    }
})


// View specific order (Owner/Admin or assigned Staff)
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id)
        return res.status(400).send({ status: 'error', msg: 'Token and order ID required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'order')
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to order operations' })

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })

        const order = await Order.findById(id)
        if (!order) return res.status(404).send({ status: 'error', msg: 'Order not found' })

        return res.status(200).send({ status: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error fetching order', error: e.message })
    }
})


// Update order status (Owner/Admin or assigned Staff)
router.post('/update_status', async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status)
        return res.status(400).send({ status: 'error', msg: 'Token, order ID and status are required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'order') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to order operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role' })
        }

        const validStatuses = ["Order Placed", "Preparing", "Served", "Delivered"]
        if (!validStatuses.includes(status))
            return res.status(400).send({ status: 'error', msg: 'Invalid order status' })

        const updatedOrder = await Order.findByIdAndUpdate(id, { status, timestamp: Date.now() }, { new: true })
        if (!updatedOrder)
            return res.status(404).send({ status: 'error', msg: 'Order not found' })

        return res.status(200).send({ status: 'success', msg: `Order status updated to ${status}`, order: updatedOrder })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error updating order status', error: e.message })
    }
})


// Delete order (Owner/Admin only)
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id)
        return res.status(400).send({ status: 'error', msg: 'Token and order ID are required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Only Owner/Admin can delete orders.' })
        }

        const deleted = await Order.findByIdAndDelete(id)
        if (!deleted)
            return res.status(404).send({ status: 'error', msg: 'Order not found or already deleted' })

        return res.status(200).send({ status: 'success', msg: 'Order deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error deleting order', error: e.message })
    }
})


// Filter (Owner/Admin only)
router.post('/filter', async (req, res) => {
    const { token, status, startDate, endDate } = req.body
    if (!token)
        return res.status(400).send({ status: 'error', msg: 'Token required' })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ['Owner', 'Admin']
        if (!allowedRoles.includes(decoded.role))
            return res.status(403).send({ status: 'error', msg: 'Access denied. Unauthorized role.' })

        const query = {}

        if (status) query.status = status
        if (startDate && endDate) {
            query.order_date = { $gte: new Date(startDate), $lte: new Date(endDate) }
        }

        const orders = await Order.find(query).sort({ order_date: -1 })
        if (!orders.length)
            return res.status(200).send({ status: 'ok', msg: 'No orders found matching filter' })

        return res.status(200).send({ status: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })

        return res.status(500).send({ status: 'error', msg: 'Error filtering orders', error: e.message })
    }
})

module.exports = router