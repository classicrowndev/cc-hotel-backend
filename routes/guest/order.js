const express = require('express')
const router = express.Router()
const verifyToken = require('../../middleware/verifyToken')
const Order = require('../../models/order')
const Dish = require('../../models/dish')


// Place a new order
router.post('/place', verifyToken, async (req, res) => {
    const { email, dishes, room, payment_method } = req.body

    if (!email || !dishes || !room || !payment_method) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }

    try {
        if (!Array.isArray(dishes) || dishes.length === 0) {
            return res.status(400).send({ status: 'error', msg: 'Dishes must be provided as a non-empty array' })
        }

        let totalAmount = 0
        const orderDishes = []

        // Validate each dish and calculate total
        for (const item of dishes) {
            const foundDish = await Dish.findOne({ name: item.name, status: 'Available' })

            if (!foundDish) {
                return res.status(400).send({ status: 'error', msg: `Dish "${item.name}" not found or unavailable` })
            }

            const quantity = item.quantity || 1
            const price = foundDish.amount_per_portion * quantity

            totalAmount += price
            orderDishes.push({
                name: foundDish.name,
                quantity,
                price
            })

            // Optional: reduce stock quantity (if you track it)
            if (foundDish.quantity > 0) {
                foundDish.quantity -= quantity
                await foundDish.save()
            }
        }

        const order = new Order({
            guest: req.user._id,
            email,
            dishes: orderDishes,
            room,
            amount: totalAmount,
            payment_method,
            order_date: new Date(),
            timestamp: Date.now()
        })

        await order.save()
        return res.status(200).send({ status: 'ok', msg: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all orders by a guest
router.post('/all', verifyToken, async (req, res) => {
    try {
        // Fetch all orders
        const orders = await Order.find({ guest: req.user._id }).sort({ order_date: -1 })
        if (orders.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No orders found for this guest' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View a specific order
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Order ID is required' })
    }

    try {
        // Fetch the order
        const order = await Order.findById(id)
        if (!order) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        if (order.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access to this order' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Cancel an order (if still pending)
router.post('/cancel', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Order ID is required' })
    }

    try {
        // Fetch the order
        const order = await Order.findById(id)
        if (!order) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        if (order.guest.toString() !== req.user._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access to this order' })
        }

        if (order.status !== 'Order Placed') {
            return res.status(400).send({ status: 'error', msg: 'Only pending orders can be cancelled' })
        }

        order.status = 'Order Cancelled'
        await order.save()

        return res.status(200).send({ status: 'ok', msg: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router
