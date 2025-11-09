const express = require('express')
const router = express.Router()
const Contact = require('../../models/contact')


// Get contact info for guests
router.post('/info', async (req, res) => {
    try {
        const contact = await Contact.findOne()
        if (!contact) return res.status(404).send({ status: 'error', msg: 'Contact info not found' });
        res.status(200).send({ status: 'ok', contact })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router