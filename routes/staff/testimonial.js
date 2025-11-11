const express = require('express')
const router = express.Router()

const Testimonial = require("../../models/testimonial.js")


// View all testimonials (public)
router.post('/all', async (req, res) => {
    try {
        // fetch all public testimonials
        const testimonials = await Testimonial.find().populate('guest', 'fullname email').sort({ timestamp: -1 })

        if (!testimonials.length) {
            return res.status(200).send({ status: 'ok', msg: 'No testimonials yet.' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', testimonials })

    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router