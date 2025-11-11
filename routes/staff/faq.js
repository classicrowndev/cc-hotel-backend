const express = require('express')
const router = express.Router()
const verifyToken = require('../../middleware/verifyToken')
const FAQ = require('../../models/faq')


// Role checker
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


//Add a new FAQ (Owner/Admin only)
router.post('/add', verifyToken, async (req, res) => {
    const { question, answer } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add FAQ.' })
    }

    if (!question || !answer) {
        return res.status(400).send({ status: 'error', msg: 'Both question and answer are required.' })
    }

    try {
        const faq = new FAQ({ question, answer, timestamp: Date.now() })
        await faq.save()
        return res.status(200).send({ status: 'ok', msg: 'success', faq })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


//Update an existing FAQ (Owner/Admin only)
router.post('/update', verifyToken, async (req, res) => {
    const { id, question, answer } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update FAQ.' })
    }

    if (!id || (!question && !answer)) {
        return res.status(400).send({ status: 'error', msg: 'FAQ ID and at least one field to update are required.' })
    }

    try {
        const updatedFAQ = await FAQ.findByIdAndUpdate(
            id,
            { $set: { ...(question && { question }), ...(answer && { answer }) } },
            { new: true }
        )

        if (!updatedFAQ) {
            return res.status(404).send({ status: 'error', msg: 'FAQ not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', updatedFAQ })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete an FAQ (Owner/Admin only)
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can delete FAQ.' })
    }

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'FAQ ID is required' })
    }

    try {
        const deletedFAQ = await FAQ.findByIdAndDelete(id)
        if (!deletedFAQ) {
            return res.status(404).send({ status: 'error', msg: 'FAQ not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', deletedFAQ })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


//View all FAQs (accessible to all staff roles)
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const faqs = await FAQ.find().sort({ timestamp: -1 })
        return res.status(200).send({ status: 'ok', msg: 'success', faqs })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


//View a single FAQ by ID
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'])) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'FAQ ID is required.' })
    }

    try {
        const faq = await FAQ.findById(id)
        if (!faq) {
            return res.status(404).send({ status: 'error', msg: 'FAQ not found.' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', faq })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router