const express = require('express')
const router = express.Router()

const Newsletter = require('../../models/newsletter')

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
    const { email } = req.body

    if (!email) {
        return res.status(400).send({ status: 'error', msg: 'Email is required' })
    }

    try {
        const exists = await Newsletter.findOne({ email })
        if (exists) {
            return res.status(200).send({ status: 'ok', msg: 'Already subscribed' })
        }

        await Newsletter.create({ email })

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router