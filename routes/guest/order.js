const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Order = require('../../models/order')
const Dish = require('../../models/dish')


// Place a new order
router.post('/place', async (req, res) => {
    const { token, email, dishes, room, payment_method } = req.body

    if (!token || !email || !dishes || !room || !payment_method) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

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
            guest: guest._id,
            email,
            dishes: orderDishes,
            room,
            amount: totalAmount,
            payment_method,
            order_date: new Date(),
            timestamp: Date.now()
        })

        await order.save()
        return res.status(200).send({ status: 'success', msg: 'Order placed successfully', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error placing order', error: e.message })
    }
})


// View all orders by a guest
router.post('/all', async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch all orders
        const orders = await Order.find({ guest: guest._id }).sort({ order_date: -1 })
        if (orders.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No orders found for this guest' })
        }

        return res.status(200).send({ status: 'success', count: orders.length, orders })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
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
        // verify the guest's toen
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch the order
        const order = await Order.findById(id)
        if (!order) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        if (order.guest.toString() !== guest._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access to this order' })
        }

        return res.status(200).send({ status: 'success', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching order', error: e.message })
    }
})


// Cancel an order (if still pending)
router.post('/cancel', async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and order ID are required' })
    }

    try {
        // Verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch the order
        const order = await Order.findById(id)
        if (!order) {
            return res.status(400).send({ status: 'error', msg: 'Order not found' })
        }

        if (order.guest.toString() !== guest._id.toString()) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized access to this order' })
        }

        if (order.status !== 'Order Placed') {
            return res.status(400).send({ status: 'error', msg: 'Only pending orders can be cancelled' })
        }

        order.status = 'Cancelled'
        await order.save()

        return res.status(200).send({ status: 'success', msg: 'Order cancelled successfully', order })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error cancelling order', error: e.message })
    }
})

module.exports = router
