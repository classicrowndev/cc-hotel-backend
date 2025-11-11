const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Service = require('../../models/service')
const ServiceRequest = require('../../models/serviceRequest')


// Fetch all available services
router.post('/all', async (req, res) => {
    try {
        // find all available services
        const services = await Service.find({ status: "Available" }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No available services found', count: 0, services: [] })

        return res.status(200).send({ status: 'ok', msg: 'success', count: services.length, services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// View details of a single service
router.post('/view', async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Service ID is required' })
    }

    try {
        // Find the available service
        const service = await Service.findById(id)
        if (!service) return res.status(400).send({ status: 'error', msg: 'Service not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', service })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Filter services by type
router.post('/filter', async (req, res) => {
    const { service_type } = req.body
    if (!service_type) {
        return res.status(400).send({ status: 'error', msg: 'Service type is required' })
    }

    try {
        // find the filtered services
        const services = await Service.find({ service_type, status: "Available" }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No services found', count: 0, services: [] })

        return res.status(200).send({ status: 'ok', msg: 'success', count: services.length, services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Search services by name
router.post('/search', async (req, res) => {
    const { keyword } = req.body
    if (!keyword) {
        return res.status(400).send({ status: 'error', msg: 'Search keyword is required' })
    }

    try {
        // fetch all services
        const services = await Service.find({
            name: { $regex: keyword, $options: 'i' },
            status: "Available"
        }).sort({ timestamp: -1 })

        if (services.length === 0)
            return res.status(200).send({ status: 'ok', msg: 'No services found', count: 0, services: [] })

        return res.status(200).send({ status: 'ok', msg: 'success', count: services.length, services })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Guest requests a service (e.g. Laundry, Spa)
router.post('/request', verifyToken, async (req, res) => {
    const { email, id, room } = req.body

    if (!email || !id || !room ) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required' })
    }
    
    try {
        // Fetch the services requested
        const service = await Service.findById(id)
        if (!service) {
            return res.status(400).send({ status: 'error', msg: 'Service not found' })
        }

        if (service.status !== "Available") {
            return res.status(400).send({ status: 'error', msg: 'Service currently not available' })
        }

        const request = new ServiceRequest({
            guest: req.user._id,
            email,
            service: service._id,
            room,
            amount: service.price,
            timestamp: Date.now()
        })

        await request.save()

        return res.status(200).send({ status: 'ok', msg: 'success', request})
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// view the service request status
router.post('/request_status', verifyToken, async (req, res) => {
    const { request_id } = req.body
    if (!request_id) {
        return res.status(400).send({ status: 'error', msg: 'Request ID is required' })
    }

    try {
        // find the guest's own request
        const request = await ServiceRequest.findOne({ _id: request_id, guest: req.user._id })

        if (!request) {
            return res.status(400).send({ status: 'error', msg: 'Service request not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', request })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') 
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router
