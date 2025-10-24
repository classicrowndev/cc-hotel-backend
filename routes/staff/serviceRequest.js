const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const ServiceRequest = require('../models/serviceRequest')
const Service = require('../models/service')
const Guest = require('../models/guest')

// Fetch all service requests
router.post('/all', async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token is required' })
    }

    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)

        // find all service requests (populate related details)
        const requests = await ServiceRequest.find().populate('guest', 'fullname email')
            .populate('service', 'name service_type').sort({ request_date: -1 })

        if (requests.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No service requests found' })
        }

        return res.status(200).send({ status: 'success', requests })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }

        return res.status(500).send({ status: 'error', msg: 'Error fetching service requests', error: e.message })
    }
})


// View a specific service request
router.post('/view', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and request ID are required' })
    }

    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)

        const request = await ServiceRequest.findById(id).populate('guest', 'fullname email')
            .populate('service', 'name service_type')

        if (!request) {
            return res.status(404).send({ status: 'error', msg: 'Service request not found' })
        }

        return res.status(200).send({ status: 'success', request })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }

        return res.status(500).send({ status: 'error', msg: 'Error fetching service request', error: e.message })
    }
})


// Update request status
router.post('/update_status', async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status) {
        return res.status(400).send({ status: 'error', msg: 'Token, request ID, and status are required' })
    }

    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)

        // update the status of the service request
        const updated = await ServiceRequest.findByIdAndUpdate(id, { status }, { new: true })

        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Service request not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Request status updated successfully', updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }

        return res.status(500).send({ status: 'error', msg: 'Error updating service request', error: e.message })
    }
})


// Delete a service request
router.post('/delete', async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: 'error', msg: 'Token and request ID are required' })
    }

    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)

        const deleted = await ServiceRequest.findByIdAndDelete(id)

        if (!deleted) {
            return res.status(404).send({ status: 'error', msg: 'Service request not found' })
        }

        return res.status(200).send({ status: 'success', msg: 'Service request deleted successfully' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        
        return res.status(500).send({ status: 'error', msg: 'Error deleting service request', error: e.message })
    }
})

module.exports = router
