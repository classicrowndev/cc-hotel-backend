const express = require('express')
const router = express.Router()

const Service = require('../../models/service')
const ServiceRequest = require('../../models/serviceRequest')
const verifyToken = require('../../middleware/verifyToken')


// Fetch all available services
router.post('/all', verifyToken, async (req, res) => {
    try {
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
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Service ID is required' })
    }

    try {
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
router.post('/filter', verifyToken, async (req, res) => {
    const { service_type } = req.body
    if (!service_type) {
        return res.status(400).send({ status: 'error', msg: 'Service type is required' })
    }

    try {
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
router.post('/search', verifyToken, async (req, res) => {
    const { keyword } = req.body
    if (!keyword) {
        return res.status(400).send({ status: 'error', msg: 'Search keyword is required' })
    }

    try {
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
router.post('/request', verifyToken, async (req, res) => {
    const { email, id, room, payment_method, amount } = req.body

    if (!email || !id || !room || !payment_method || !amount) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }
    
    try {
        // Fetch the services requested
        const service = await Service.findById(id)
        if (!service) {
            return res.status(400).send({ status: 'error', msg: 'Service not found' })
        }

        if (!service.availability) {
            return res.status(400).send({ status: 'error', msg: 'Service is not available currently' })
        }

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

// view the service request status
router.post('/request_status', verifyToken, async (req, res) => {
    const { request_id } = req.body
    if (!request_id) {
        return res.status(400).send({ status: 'error', msg: 'Rrequest ID is required' })
    }

    try {
        // find the guest's own request
        const request = await ServiceRequest.findOne({ _id: request_id, guest: guest._id })

        if (!request) {
            return res.status(400).send({ status: 'error', msg: 'Service request not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Service request status fetched successfully',
            data: { service_name: request.service_name || undefined, 
                current_status: request.status, // e.g. Requested, In Progress, Completed, Cancelled
                requested_on: request.timestamp
            }
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching status', error: e.message })
    }
})

module.exports = router
