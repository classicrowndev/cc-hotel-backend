const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Staff = require('../models/staff')

/*
const cloudinary = require('../utils/cloudinary')
const Uploader = require('../utils/multer')
*/


// Edit Staff Profile
router.post('/edit', /*Uploader.single('image'),*/ async (req, res) => {
    const { token, fullname, email, phone_no, address, gender } = req.body

    if (!token) {
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })
    }

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        // Fetch existing staff
        let Estaff = await Staff.findById(staff._id, {
            fullname: 1,
            email: 1,
            phone_no: 1,
            address: 1,
            gender: 1,
            profile_img_id: 1,
            profile_img_url: 1
        }).lean()

        if (!Estaff) {
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
        Estaff = await Staff.findByIdAndUpdate(staff._id, updateFields, { new: true }).lean()

        return res.status(200).send({ status: 'success', msg: 'Profile updated successfully', Estaff })

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
router.post('/view', async (req, res) => {
    const { token } = req.body

    if (!token)
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const Vstaff = await Staff.findById(staff._id).lean()
        if (!Vstaff)
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        return res.status(200).send({ status: 'success', msg: 'Profile fetched successfully', Vstaff })

    } catch (error) {
        console.error(error)
        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({ status: 'error', msg: 'An error occurred while fetching the profile', error: error.message })
    }
})

module.exports = router