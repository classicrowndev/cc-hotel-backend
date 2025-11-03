const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const nodemailer = require('nodemailer')
const bcrypt = require('bcryptjs')
const verifyToken = require('../../middleware/verifyToken')
const Staff = require('../../models/staff')


// Owner creates admin or staff account
router.post('/create_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Owner') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only owner can create accounts.' })
        }

        const { fullname, email, password, phone_no, role } = req.body

        if (!fullname || !email || !password || !phone_no || !role) {
            return res.status(400).send({ status: 'error', msg: 'All fields including role are required' })
        }

        if (!['Admin', 'Staff'].includes(role)) {
            return res.status(400).send({ status: 'error', msg: 'Role must be either Admin or Staff' })
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
            role
        })

        await newStaff.save()

        // Send automatic email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER, // your gmail
                pass: process.env.MAIL_PASS, // your app password
           },
        })

        const mailOptions = {
            from: `"Classic Crown Hotel" <${process.env.MAIL_USER}>`,
            to: newStaff.email,
            subject: `Welcome to Classic Crown Hotel as ${newStaff.role}`,
            html: `
                <h2>Hi ${newStaff.fullname},</h2>
                <p>Your ${newStaff.role} account has been successfully created.</p>
                <p>Here are your login details:</p>
                <ul>
                    <li><strong>Email:</strong> ${newStaff.email}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p>Please log in and change your password immediately.</p>
                <p>Best Regards,<br/>Paradise Management Team</p>
           `,
        }

        // Send the mail (non-blocking)
        transporter.sendMail(mailOptions)
            .then(() => console.log(`Email sent to ${newStaff.email}`))
            .catch(err => console.error('Email sending error:', err))


        return res.status(201).send({ status: 'ok',
            msg: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
            data: { id: newStaff._id, fullname: newStaff.fullname, email: newStaff.email, phone_no: newStaff.phone_no,
                role: newStaff.role}
        })
    } catch (error) {
        console.error('Error creating account:', error)
        return res.status(500).send({ status: 'error', msg: 'Server error while creating account' })
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

        res.status(200).send({ status: 'ok', staffs })
    } catch (e) {
        console.error(e)
        res.status(500).send({ status: 'error', msg: 'Failed to fetch staffs' })
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

        return res.status(200).send({ status: 'ok', staff })
    } catch (e) {
        console.error(e)
        return res.status(500).send({ status: 'error', msg: `Error fetching ${role} details` })
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

        res.status(200).send({ status: 'ok', msg: `${role} deleted successfully` })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: `Failed to delete ${role}` })
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

        res.status(200).send({ status: 'ok', msg: `${role} blocked successfully`, blockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: `Failed to block ${role}` })
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

        res.status(200).send({ status: 'ok', msg: `${role} unblocked successfully`, unblockedStaff })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: `Failed to unblock ${role}` })
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
            return res.status(200).send({ status: 'ok', msg: `No blocked ${role}s`, staffs: [] })
        }

        res.status(200).send({ status: 'ok', blockedStaffs })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: 'error', msg: 'Failed to fetch blocked staffs' })
    }
})

module.exports = router