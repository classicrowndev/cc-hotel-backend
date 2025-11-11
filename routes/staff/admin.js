const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')
const verifyToken = require('../../middleware/verifyToken')
const { sendStaffAccountMail } = require('../../utils/nodemailer')
const Staff = require('../../models/staff')
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


// Admin creates staff account
router.post('/create_staff', verifyToken, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can create staff accounts.' })
        }

        const { fullname, email, password, phone_no, role, task } = req.body

        if (!fullname || !email || !password || !phone_no || !role || !task) {
            return res.status(400).send({ status: 'error', msg: 'All fields are required' })
        }

        if (!['Staff'].includes(role)) {
            return res.status(400).send({ status: 'error', msg: 'Role must be Staff' })
        }

        // Conditional validation: If role is 'Staff', task must be provided
        if (role === 'Staff' && !task) {
            return res.status(400).send({ status: 'error', msg: 'Task is required for staff accounts.'})
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
            role, // Admin can only create staff
            task: role === 'Staff' ? task : undefined, // assign task only if role is 'Staff'
        })

        await newStaff.save()

        // Send confirmation mail
        await sendStaffAccountMail(email, password, fullname, role, task //'Staff'
            )

        return res.status(201).send({
            status: 'ok',
            msg: 'success',
            data: {id: newStaff._id, fullname: newStaff.fullname, email: newStaff.email, phone_no: newStaff.phone_no,
                role: newStaff.role, task: newStaff.task
            }
        })
    } catch (error) {
        console.error('Error creating staff:', error)
        return res.status(500).send({ status: 'error', msg: 'Error occurred' })
    }
})


// Admn edits staff account
router.post("/edit_staff", verifyToken, uploader.single("profile_img"), async (req, res) => {
    try {
        const { id, ...updateData } = req.body

        if (!id) return res.status(400).send({ status: "error", msg: "Staff ID is required" })
        if (!req.user || req.user.role !== "Admin")
            return res.status(403).send({ status: "error", msg: "Access denied. Only admin can edit accounts" })

        let staff = await Staff.findById(id)
        if (!staff) return res.status(404).send({ status: "error", msg: "Staff not found" })

        // Handle profile image
        if (req.file) {
            if (staff.img_id) await cloudinary.uploader.destroy(staff.img_id)
            const upload = await cloudinary.uploader.upload(req.file.path, { folder: "staff-images" })
            updateData.img_id = upload.public_id
            updateData.img_url = upload.secure_url
        }

        // Handle task logic
        if (staff.role === "Staff") {
            if (updateData.task) {
                updateData.task = Array.isArray(updateData.task) 
                ? updateData.task 
                : [updateData.task]
            }
        } else {
            delete updateData.task  // prevent assigning tasks to non-staffs
        }


        // Whitelist allowed fields for safety
        const allowedFields = ["fullname", "email", "phone_no", "task", "address", "img_id", "img_url"]
        Object.keys(updateData).forEach(key => {
            if (!allowedFields.includes(key)) delete updateData[key]
        })

        updateData.updatedAt = Date.now()

        // Perform update
        staff = await Staff.findByIdAndUpdate(id, updateData, { new: true })

        return res.status(200).send({ status: "ok", msg: "success", staff })
    } catch (error) {
        console.error("Error editing account:", error);
        return res.status(500).send({ status: "error", msg: "An error occurred", error: error.message });
    }
})


// View all staff
router.post('/view_staffs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view staff accounts.' })
        }

        const staffs = await Staff.find({ role: 'Staff' }).select('-password').lean()
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
        if (req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view details.' })
        }

        const staff = await Staff.findOne({ _id: id, role: 'Staff' }).select('-password').lean()
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
        if (req.user.role !== 'Admin') {
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
        if (req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can block staff accounts.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
        }

        const blockedStaff = await Staff.findOneAndUpdate({ _id: id, role: 'Staff' }, { is_blocked: true }, { new: true })
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
        if (req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can unblock staff accounts.' })
        }

        const { id } = req.body
        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })
        }

        const unblockedStaff = await Staff.findOneAndUpdate({ _id: id, role: 'Staff' }, { is_blocked: false }, { new: true })

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
router.post('/blocked_staffs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only admin can view blocked staff accounts.' })
        }

        const blockedStaffs = await Staff.find({ role: 'Staff', is_blocked: true }).select('-password').lean()
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