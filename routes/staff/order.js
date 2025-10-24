const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Order = require('../models/order')
const Dish = require('../models/dish')

// ==========================================
// STAFF ORDER MANAGEMENT ENDPOINTS
// ==========================================

// Add a new order on behalf of a guest
router.post('/add', async (req, res) => {
    const { token, guest, email, dishes, room, payment_method } = req.body

    if (!token || !guest || !email || !dishes || !room || !payment_method) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }

    try {
        // Verify staff token
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        if (!Array.isArray(dishes) || dishes.length === 0) {
            return res.status(400).send({ status: 'error', msg: 'Dishes must be provided as a non-empty array' })
        }

        let totalAmount = 0
        const orderDishes = []

        // Validate dishes and compute total
        for (const item of dishes) {
            const foundDish = await Dish.findOne({ name: item.name, status: 'Available' })
            if (!foundDish) {
                return res.status(400).send({ status: 'error', msg: `Dish "${item.name}" not found or unavailable` })
            }

            const quantity = item.quantity || 1
            const price = foundDish.amount_per_portion * quantity

            totalAmount += price
            orderDishes.push({ name: foundDish.name, quantity, price })

            // Reduce stock if applicable
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
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error adding order', error: e.message })
    }
})


// View all orders (for staff overview)
router.post('/all', async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token is required' })
    }

    try {
        // Verify staff token
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const orders = await Order.find().sort({ order_date: -1 })
        if (orders.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No orders found' })
        }

        return res.status(200).send({ status: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching orders', error: e.message })
    }
})


// View a specific order
router.post('/view', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and order ID are required' })
    }

    try {
        // verify staff token
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        // fetch the order
        const order = await Order.findById(id)

        if (!order) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        return res.status(200).send({ status: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching order', error: e.message })
    }
})


// Update order status (e.g., Preparing → Served → Delivered)
router.post('/update-status', async (req, res) => {
    const { token, id, status } = req.body

    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, order ID, and new status are required' })
    }

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const validStatuses = ["Order Placed", "Preparing", "Served", "Delivered"]
        if (!validStatuses.includes(status)) {
            return res.status(400).send({ status: 'error', msg: 'Invalid order status value' })
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        )

        if (!updatedOrder) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Order status updated successfully', updatedOrder })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error updating order status', error: e.message })
    }
})


// Delete an order (if necessary)
router.post('/delete', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and order ID are required' })
    }

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const deletedOrder = await Order.findByIdAndDelete(id)
        if (!deletedOrder) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Order deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error deleting order', error: e.message })
    }
})

module.exports = router