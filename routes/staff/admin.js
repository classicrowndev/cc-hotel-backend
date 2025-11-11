const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')
const verifyToken = require('../../middleware/verifyToken')
const { sendStaffAccountMail } = require('../../utils/nodemailer')
const Staff = require('../../models/staff')


// Admin creates staff account
router.post('/create_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can create staff accounts.' })
        }

        const { fullname, email, password, phone_no } = req.body

        if (!fullname || !email || !password || !phone_no) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        const existingStaff = await Staff.findOne({ email })
        if (existingStaff) {
            return res.status(400).send({ status: 'error', msg: 'Email already exists' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const newStaff = new Staff({
            fullname,
            email,
            password: hashedPassword,
            phone_no,
            role: 'staff' // Admin can only create staff
        })

        await newStaff.save()

        // Send confirmation mail
        await sendStaffAccountMail(email, password, fullname, 'Staff')

        return res.status(201).send({
            status: 'ok',
            msg: 'success',
            data: {id: newStaff._id, fullname: newStaff.fullname, email: newStaff.email, phone_no: newStaff.phone_no,
                role: newStaff.role
            }
        })
    } catch (error) {
        console.error('Error creating staff:', error)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all staff
router.post('/view_staffs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view staff accounts.' })
        }

        const staffs = await Staff.find({ role: 'staff' }).select('-password').lean()
        if (staffs.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No staff found', staffs: [] })
        }

        res.status(200).send({ status: 'ok', msg: 'success', count: staffs.length, staffs })
    } catch (e) {
        console.error(e)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View a specific staff
router.post('/view_staff', verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
    }

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view details.' })
        }

        const staff = await Staff.findOne({ _id: id, role: 'staff' }).select('-password').lean()
        if (!staff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', staff })
    } catch (e) {
        console.error(e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Delete staff
router.post('/delete_staff', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can delete staff accounts.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
        }

        const deletedStaff = await Staff.findOneAndDelete({ _id: id, role: 'staff' })
        if (!deletedStaff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', deletedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Block staff
router.post('/block_staff', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can block staff accounts.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
        }

        const blockedStaff = await Staff.findOneAndUpdate({ _id: id, role: 'staff' }, { is_blocked: true }, { new: true })
        if (!blockedStaff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', blockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Unblock staff
router.post('/unblock_staff', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can unblock staff accounts.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
        }

        const unblockedStaff = await Staff.findOneAndUpdate({ _id: id, role: 'staff' }, { is_blocked: false }, { new: true })

        if (!unblockedStaff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }

        res.status(200).send({ status: 'ok', msg: 'success', unblockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all blocked staff
router.get('/blocked_staffs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view blocked staff accounts.' })
        }

        const blockedStaffs = await Staff.find({ role: 'staff', is_blocked: true }).select('-password').lean()
        if (blockedStaffs.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No blocked staff found', staffs: [] })
        }
        res.status(200).send({ status: 'ok', msg: 'success', blockedStaffs, count: blockedStaffs.length })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})

module.exports = router