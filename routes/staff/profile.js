const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Staff = require('../../models/staff')

/*
const cloudinary = require('../../utils/cloudinary')
const Uploader = require('../../utils/multer')
*/


// Edit Staff Profile
router.post('/edit', /*Uploader.single('image'),*/ verifyToken, async (req, res) => {
    const { fullname, email, phone_no, address, gender } = req.body

    try {
        // Fetch existing staff
        let staff = await Staff.findById(req.user._id, {
            fullname: 1,
            email: 1,
            phone_no: 1,
            address: 1,
            gender: 1,
            profile_img_id: 1,
            profile_img_url: 1
        }).lean()

        if (!staff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }
        
        // Prepare update object
        const updateFields = {}
        if (fullname) updateFields.fullname = fullname
        if (email) updateFields.email = email
        if (phone_no) updateFields.phone_no = phone_no
        if (address) updateFields.address = address
        if (gender) updateFields.gender = gender

        /*
        // If implementing image upload later:
        let profile_img_id = "", profile_img_url = ""
        if (req.file) {
            if (Estaff.profile_img_id)
                await cloudinary.uploader.destroy(Estaff.profile_img_id)

            const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
                folder: "staff-images",
            })
            profile_img_id = public_id
            profile_img_url = secure_url
            updateFields.profile_img_id = profile_img_id
            updateFields.profile_img_url = profile_img_url
        }
        */

        // Update staff document
        staff = await Staff.findByIdAndUpdate(staff._id, updateFields, { new: true }).lean()

        return res.status(200).send({ status: 'success', msg: 'Profile updated successfully', staff })

    } catch (error) {
        console.error(error)
        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({ status: 'error', msg: 'An error occurred while updating the profile', error: error.message })
    }
})

// -----------------------------
// View Staff Profile
// -----------------------------
router.post('/view', verifyToken, async (req, res) => {
    try {
        const staff = await Staff.findById(req.user._id).lean()
        if (!staff)
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        return res.status(200).send({ status: 'success', msg: 'Profile fetched successfully', staff })

    } catch (error) {
        console.error(error)
        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({ status: 'error', msg: 'An error occurred while fetching the profile', error: error.message })
    }
})

module.exports = router