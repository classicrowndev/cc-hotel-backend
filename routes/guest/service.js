const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Service = require('../models/service')
const ServiceRequest = require('../models/serviceRequest')


// Fetch all available services
router.post('/all', async (req, res) => {
    const { token } = req.body

    if (!token) return res.status(400).send({ status: 'error', msg: 'Token must be provided' })

    try {
        // verify guest's token
        jwt.verify(token, process.env.JWT_SECRET)

        // find all available services
        const services = await Service.find({ availability: true }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No available services found' })

        return res.status(200).send({ status: 'success', services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching services', error: e.message })
    }
})

// View details of a single service
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id)
        return res.status(400).send({ status: 'error', msg: 'Token and service ID are required' })

    try {
        //verify guest's token
        jwt.verify(token, process.env.JWT_SECRET)

        // Find the available service
        const service = await Service.findById(id)
        if (!service) return res.status(400).send({ status: 'error', msg: 'Service not found' })

        return res.status(200).send({ status: 'success', service })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching service details', error: e.message })
    }
})

// Filter services by type
router.post('/filter', async (req, res) => {
    const { token, service_type } = req.body
    if (!token || !service_type)
        return res.status(400).send({ status: 'error', msg: 'Token and service type are required' })

    try {
        // verify guest's token
        jwt.verify(token, process.env.JWT_SECRET)

        // find the filtered services
        const services = await Service.find({ service_type, availability: true }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No services found for this type' })

        return res.status(200).send({ status: 'success', services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error filtering services', error: e.message })
    }
})

// Search services by name
router.post('/search', async (req, res) => {
    const { token, keyword } = req.body
    if (!token || !keyword)
        return res.status(400).send({ status: 'error', msg: 'Token and search keyword are required' })

    try {
        // verify guest's token
        jwt.verify(token, process.env.JWT_SECRET)

        // fetch all services
        const services = await Service.find({
            name: { $regex: keyword, $options: 'i' },
            availability: true
        }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No services match your search' })

        return res.status(200).send({ status: 'success', services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error searching services', error: e.message })
    }
})


// Guest requests a service (e.g. Laundry, Spa)
router.post('/request', async (req, res) => {
    const { token, email, id, room, payment_method, amount } = req.body

    if (!token || !email || !id || !room || !payment_method || !amount)
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })

    try {
        // verify guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch the services requested
        const service = await Service.findById(id)
        if (!service) return res.status(400).send({ status: 'error', msg: 'Service not found' })
        if (!service.availability)
            return res.status(400).send({ status: 'error', msg: 'Service is not available currently' })

        const request = new ServiceRequest({
            guest: guest._id,
            email,
            service: service._id,
            room,
            payment_method,
            amount,
            timestamp: Date.now()
        })

        await request.save()

        return res.status(200).send({ status: 'success', msg: 'Service requested successfully', request})
    } catch (e) {
        if (e.name === 'JsonWebTokenError') { 
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error requesting service', error: e.message })
    }
})

module.exports = router
