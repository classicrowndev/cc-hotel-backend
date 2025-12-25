const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Staff = require('../../models/staff')

const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')



// endpoint to edit profile
router.post('/edit', uploader.array('profile_img'), verifyToken, async (req, res) => {
    try {
        const { fullname, email, phone_no, address, gender } = req.body

        let staff = await Staff.findById(req.user._id);
        if (!staff) {
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })
        }

        const uploadedPhotos = []

        // If new files are uploaded, process them
        if (req.files && req.files.length > 0) {
            // Delete previous image if it exists to replace it
            if (staff.profile_img_id) {
                try {
                    await cloudinary.uploader.destroy(staff.profile_img_id)
                } catch (err) {
                    console.error("Cloudinary delete error:", err)
                }
            }

            // Upload each file
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, {
                    folder: "staff-images"
                })

                // Update the profile with the last uploaded photo
                staff.profile_img_url = upload.secure_url
                staff.profile_img_id = upload.public_id

                uploadedPhotos.push(upload)
            }
        }

        // Update other fields
        staff.fullname = fullname || staff.fullname
        staff.email = email || staff.email
        staff.phone_no = phone_no || staff.phone_no
        staff.address = address || staff.address
        staff.gender = gender || staff.gender

        await staff.save()

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            file: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
            staff
        })

    } catch (error) {
        console.error(error)

        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({
            status: 'error',
            msg: 'Error occurred',
            error: error.message
        })
    }
})


// View Staff Profile
router.post('/view', verifyToken, async (req, res) => {
    try {
        const staff = await Staff.findById(req.user._id).lean()
        if (!staff)
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', staff })

    } catch (error) {
        console.error(error)
        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: error.message })
    }
})

module.exports = router