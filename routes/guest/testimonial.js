const express = require('express')
const router = express.Router()

const Testimonial = require("../../models/testimonial.js")
const verifyToken = require('../../middleware/verifyToken')


// Create a new testimonial
router.post('/create', verifyToken, async (req, res) => {
    const { comment, rating } = req.body

    if (!comment || rating === undefined || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).send({ status: 'error', msg: 'All fields are required and rating must be 1-5.' });
   }


    try {
        // Create testimonial
        const testimonial = new Testimonial({
            guest: req.user._id,
            comment,
            rating,
            timestamp: Date.now()
        })

        await testimonial.save()

        return res.status(200).send({status: 'ok', msg: 'success', testimonial})

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
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
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View testimonials by logged-in guest
router.post('/mine', verifyToken, async (req, res) => {
    try {
        // fetch all testimonials
        const testimonials = await Testimonial.find({ guest: req.user._id }).sort({ timestamp: -1 })

        if (!testimonials.length) {
            return res.status(200).send({ status: 'ok', msg: 'You have not submitted any testimonials yet.' })
        }

        return res.status(200).send({ status: 'ok', testimonials })

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router