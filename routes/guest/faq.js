const express = require('express')
const router = express.Router()

const FAQ = require("../../models/faq.js");


// View all FAQs
router.post("/all", async (req, res) => {
    try {
        const faqs = await FAQ.find().sort({ timestamp: -1 })

        return res.status(200).send({status: 'ok', faqs})
    } catch (e) {
        /* JWT error handler commented out for now — FAQ is public,
        but can be re-enabled later if authentication is added. */
        /*if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }*/
        return res.status(500).send({ status: 'error', msg: "Failed to fetch FAQs", error: e.message })
    }
})

// Get single FAQ by ID (via req.body)
router.post("/view", async (req, res) => {
    try {
        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: "FAQ ID is required" })
        }

        const faq = await FAQ.findById(id)
        if (!faq) {
            return res.status(400).send({ msg: "FAQ not found" })
        }

        return res.status(200).send({ status: 'ok', faq})
    } catch (e) {
        /* JWT error handler commented out for now — FAQ is public,
        but can be re-enabled later if authentication is added. */

        /*if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }*/
        return res.status(500).send({ status: 'error', msg: "Failed to fetch FAQ", error: e.message })
    }
})

module.exports = router
