const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')

import Testimonial from "../models/testimonial.js"


// Create a new testimonial
router.post('/create', async (req, res) => {
    const { token, comment, rating } = req.body

    if (!token || !comment || !rating) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required.' })
    }

    try {
        // Verify guest token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // Create testimonial
        const testimonial = new Testimonial({
            guest: guest._id,
            comment,
            rating,
            timestamp: Date.now()
        })

        await testimonial.save()

        return res.status(200).send({status: 'success', msg: 'Testimonial submitted successfully.', testimonial})

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error submitting testimonial', error: e.message })
    }
})


// View all testimonials (public)
router.post('/all', async (req, res) => {
    try {
        // fetch all public testimonials
        const testimonials = await Testimonial.find().populate('guest', 'fullname email').sort({ timestamp: -1 })

        if (!testimonials.length) {
            return res.status(200).send({ status: 'ok', msg: 'No testimonials yet.' })
        }

        return res.status(200).send({ status: 'ok', testimonials })

    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error fetching testimonials.', error: e.message })
    }
})


// View testimonials by logged-in guest
router.post('/mine', async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token is required.' })
    }

    try {
        // verify the guest's token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        // fetch all testimonials
        const testimonials = await Testimonial.find({ guest: guest._id }).sort({ timestamp: -1 })

        if (!testimonials.length) {
            return res.status(200).send({ status: 'ok', msg: 'You have not submitted any testimonials yet.' })
        }

        return res.status(200).send({ status: 'ok', testimonials })

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching guest testimonials.', error: e.message })
    }
})

export default router