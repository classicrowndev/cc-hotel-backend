const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')
const verifyToken = require('../../middleware/verifyToken')
const { sendStaffAccountMail } = require('../../utils/nodemailer')
const Staff = require('../../models/staff')


// Owner creates admin or staff account
router.post('/create_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only owner can create accounts.' })
        }

        const { fullname, email, password, phone_no, role, task } = req.body

        if (!fullname || !email || !password || !phone_no || !role) {
            return res.status(400).send({ status: 'error', msg: 'All fields including role are required' })
        }

        if (!['Admin', 'Staff'].includes(role)) {
            return res.status(400).send({ status: 'error', msg: 'Role must be either Admin or Staff' })
        }

        // If role is Staff, task becomes mandatory
        if (role === 'Staff' && !task) {
            return res.status(400).send({ status: 'error', msg: 'Task is required for staff accounts' })
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
            role,
            task: role === 'Staff' ? task : undefined, // assign task only if role is 'Staff'
        })

        await newStaff.save()

        console.log("Sending email to:", email)


        // Send confirmation mail (non-blocking)
        await sendStaffAccountMail(email, password, fullname, role)

        return res.status(201).send({ status: 'ok',
            msg: 'success',
            data: { id: newStaff._id, fullname: newStaff.fullname, email: newStaff.email, phone_no: newStaff.phone_no,
                role: newStaff.role, task: newStaff.task }
        })
    } catch (error) {
        console.error('Error creating account:', error)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all admins or staff
router.post('/view_staffs', verifyToken, async (req, res) => {
    try {
        if (!req.user.role || req.user.role.toLowerCase() !== 'owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner can view accounts.' })
        }

        /*const { role } = req.body
        let query = {}

        if (role) {
            const roleFormatted = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
            if (!['Admin', 'Staff'].includes(roleFormatted)) {
                return res.status(400).send({ status: 'error', msg: 'Role must be Admin or Staff' })
            }
            query.role = roleFormatted
        } else {
            query.role = { $in: ['Admin', 'Staff'] } // fetch both Admins & Staffs
        }*/

        // Fetch all Admins and Staffs
        const staffs = await Staff.find({ role: { $in: ['Admin', 'Staff'] } }).select('-password').lean()
        if (staffs.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No staffs found', staffs: [] })
        }

        res.status(200).send({ status: 'ok', msg:'success', count: staffs.length, staffs })
    } catch (e) {
        console.error(e)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View specific admin or staff
router.post('/view_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user.role || req.user.role.toLowerCase() !== 'owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner can view details.' })
        }

        const { id, role } = req.body
        if (!id || !role) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID and role are required' })
        }

        const staff = await Staff.findOne({ _id: id, role }).select('-password').lean()
        if (!staff) {
            return res.status(404).send({ status: 'error', msg: `${role} not found` })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', staff })
    } catch (e) {
        console.error(e)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Delete admin or staff
router.post('/delete_staff', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'Owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner can delete staff account.' })
        }

        const { id, role } = req.body
        if (!id || !role) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID and role are required' })
        }

        const deletedStaff = await Staff.findOneAndDelete({ _id: id, role })
        if (!deletedStaff) {
            return res.status(404).send({ status: 'error', msg: `${role} not found` })
        }

        res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Block admin or staff
router.post('/block_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user.role || req.user.role.toLowerCase() !== 'owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only owner can block staff account.' })
        }

        const { id, role } = req.body
        if (!id || !role) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID and role are required' })
        }

        const blockedStaff = await Staff.findOneAndUpdate({ _id: id, role }, { is_blocked: true }, { new: true })
        if (!blockedStaff) {
            return res.status(404).send({ status: 'error', msg: `${role} not found` })
        }

        res.status(200).send({ status: 'ok', msg: 'success', blockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Unblock admin or staff
router.post('/unblock_staff', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'Owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner can unblock accounts.' })
        }

        const { id, role } = req.body
        if (!id || !role) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID and role are required' })
        }

        const unblockedStaff = await Staff.findOneAndUpdate({ _id: id, role }, { is_blocked: false }, { new: true }
        )

        if (!unblockedStaff) {
            return res.status(404).send({ status: 'error', msg: `${role} not found` })
        }

        res.status(200).send({ status: 'ok', msg: 'success', unblockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// View all blocked admins or staff
router.post('/blocked_staffs', verifyToken, async (req, res) => {
    try {
        if (!req.user.role || req.user.role.toLowerCase() !== 'owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner can view blocked staff accounts.' })
        }

        // Fetch all blocked Admins and Staffs
        const blockedStaffs = await Staff.find({ role: { $in: ['Admin', 'Staff'] }, is_blocked: true })
            .select('-password').lean()

        if (blockedStaffs.length === 0) {
            return res.status(200).send({ status: 'ok', msg: 'No blocked staffs found', blockedStaffs: [] })
        }
        if (blockedStaffs.length === 0) {
            return res.status(200).send({ status: 'ok', msg: `No blocked ${role}s`, blockedStaffs: [] })
        }

        res.status(200).send({ status: 'ok', msg: 'success', count: blockedStaffs.length, blockedStaffs })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})

module.exports = router