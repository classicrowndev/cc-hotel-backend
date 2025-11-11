const express = require('express')
const router = express.Router()

const Contact = require('../../models/contact')
const verifyToken = require('../../middleware/verifyToken')


// Role checker
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// Get contact info (staff can see it too)
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const contact = await Contact.findOne()
        if (!contact) return res.status(404).send({ status: 'error', msg: 'Contact info not found' })
        res.status(200).send({ status: 'ok', msg: 'success', contact })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update contact info (staff only)
router.post('/update', verifyToken, async (req, res) => {
    const { address, phone_no, email } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update contact info.' })
    }

    try {
        let contact = await Contact.findOne()
        if (!contact) {
            // If not exists, create one
            contact = new Contact({ address, phone_no, email })
        } else {
            contact.address = address || contact.address
            contact.phone_no = phone_no || contact.phone_no
            contact.email = email || contact.email
        }
        await contact.save()
        res.status(200).send({ status: 'ok', msg: 'success', contact })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router