const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Staff = require('../../models/staff')

const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')



// Edit Staff Profile
router.post('/edit', uploader.single('profile_img'), verifyToken, async (req, res) => {
    const { fullname, email, phone_no, address, gender, profile_img_url, profile_img_id } = req.body

    try {
        let staff = await Staff.findById(req.user._id, {
            fullname: 1,
            email: 1,
            phone_no: 1,
            address: 1,
            gender: 1,
            profile_img_id: 1,
            profile_img_url: 1
        })

        if (!staff)
            return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        // Default existing image data
        let final_img_id = staff.profile_img_id
        let final_img_url = staff.profile_img_url

        // === Option 1: If new file uploaded ===
        if (req.file) {
            // Delete previous image if exists
            if (staff.profile_img_id) {
                await cloudinary.uploader.destroy(staff.profile_img_id);
            }

            // Upload new image
            const upload = await cloudinary.uploader.upload(req.file.path, {
                folder: "staff-images"
            })

            final_img_id = upload.public_id
            final_img_url = upload.secure_url
        }

        // === Option 2: If image info passed directly in body ===
        else if (profile_img_url) {
            // If both id and url passed, use both
            final_img_id = profile_img_id || staff.profile_img_id
            final_img_url = profile_img_url
        }

        // === Update staff info ===
        staff = await  Staff.findByIdAndUpdate(staff._id,
            {
                fullname: fullname || staff.fullname,
                email: email || staff.email,
                phone_no: phone_no || staff.phone_no,
                address: address || staff.address,
                gender: gender || staff.gender,
                profile_img_id: final_img_id,
                profile_img_url: final_img_url
            },
            { new: true }
        ).lean()

        return res.status(200).send({ status: 'ok', msg: 'success', staff })

    } catch (error) {
        console.error(error)

        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })

        return res.status(500).send({status: 'error', msg: 'Error occurred', error: error.message
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