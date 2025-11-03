const express = require('express')
const router = express.Router()
const verifyToken = require('../../middleware/verifyToken')

// Import models
const Room = require('../models/room')
const Dish = require('../models/dish')
const Event = require('../models/event')
const Service = require('../models/service')

// -----------------------------
// Price Management Routes
// -----------------------------

// Helper: Only Owner can edit price
const canEditPrice = (staff) => {
    return staff.role === 'Owner'
}

// -----------------------------
// Update Room Price
// -----------------------------
router.post('/room', verifyToken, async (req, res) => {
    const { id, newPrice } = req.body
    if (!id || newPrice == null) return res.status(400).send({ status: 'error', msg: 'id and newPrice are required' })
    if (!canEditPrice(req.user)) return res.status(403).send({ status: 'error', msg: 'Access denied' })

    try {
        const room = await Room.findById(id)
        if (!room) return res.status(404).send({ status: 'error', msg: 'Room not found' })

        room.price = newPrice
        await room.save()

        return res.status(200).send({ status: 'success', msg: `Room price updated to ₦${newPrice}`, room })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error updating Room price', error: e.message })
    }
})

// -----------------------------
// Update Dish Price
// -----------------------------
router.post('/dish', verifyToken, async (req, res) => {
    const { id, newPrice } = req.body
    if (!id || newPrice == null) return res.status(400).send({ status: 'error', msg: 'id and newPrice are required' })
    if (!canEditPrice(req.user)) return res.status(403).send({ status: 'error', msg: 'Access denied' })

    try {
        const dish = await Dish.findById(id)
        if (!dish) return res.status(404).send({ status: 'error', msg: 'Dish not found' })

        dish.price = newPrice
        await dish.save()

        return res.status(200).send({ status: 'success', msg: `Dish price updated to ₦${newPrice}`, dish })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error updating Dish price', error: e.message })
    }
})

// -----------------------------
// Update Event Price
// -----------------------------
router.post('/event', verifyToken, async (req, res) => {
    const { id, newPrice } = req.body
    if (!id || newPrice == null) return res.status(400).send({ status: 'error', msg: 'id and newPrice are required' })
    if (!canEditPrice(req.user)) return res.status(403).send({ status: 'error', msg: 'Access denied' })

    try {
        const event = await Event.findById(id)
        if (!event) return res.status(404).send({ status: 'error', msg: 'Event not found' })

        event.price = newPrice
        await event.save()

        return res.status(200).send({ status: 'success', msg: `Event price updated to ₦${newPrice}`, event })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error updating Event price', error: e.message })
    }
})

// -----------------------------
// Update Service Price
// -----------------------------
router.post('/service', verifyToken, async (req, res) => {
    const { id, newPrice } = req.body
    if (!id || newPrice == null) return res.status(400).send({ status: 'error', msg: 'id and newPrice are required' })
    if (!canEditPrice(req.user)) return res.status(403).send({ status: 'error', msg: 'Access denied' })

    try {
        const service = await Service.findById(id)
        if (!service) return res.status(404).send({ status: 'error', msg: 'Service not found' })

        service.price = newPrice
        await service.save()

        return res.status(200).send({ status: 'success', msg: `Service price updated to ₦${newPrice}`, service })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error updating Service price', error: e.message })
    }
})

module.exports = router