const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Guest = require('../../models/guest')

const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//edit profile
// router.post('/edit', uploader.single('profile_img'), verifyToken, async(req, res) =>{
//     const {fullname, email, phone_no, address, gender} = req.body
//     try {
//         let guest = await Guest.findById(req.user._id,
//             {fullname: 1, email: 1, phone_no: 1, address: 1, gender: 1, profile_img_id: 1, profile_img_url: 1}
//         )

//         if(!guest)
//             return res.status(200).send({status: 'ok', msg: 'No guest found'})

//         // check if a new image was uploaded
//         let profile_img_id= guest.profile_img_id
//         let profile_img_url = guest.profile_img_url

//         // check if guest passed in an image to upload
//         if(req.file) {
//             //checks if there was a profile picture there before and destroy
//             if(guest.profile_img_id)
//                 await cloudinary.uploader.destroy(guest.profile_img_id)

//             //upload new image
//             const{secure_url, public_id} = await cloudinary.uploader.upload(req.file.path, {
//                 folder: "guest-images",
//             })

//             profile_img_id = public_id
//             profile_img_url = secure_url
//         }

//         //update guest document
//         guest = await Guest.findByIdAndUpdate({_id: guest._id}, {
//             fullname: fullname || guest.fullname,
//             email: email || guest.email,
//             phone_no: phone_no || guest.phone_no,
//             address: address || guest.address,
//             gender: gender || guest.gender,
//             profile_img_id: profile_img_id || guest.profile_img_id,
//             profile_img_url: profile_img_url || guest.profile_img_url
//         }, {new: true}).lean()

//         return res.status(200).send({status: 'ok', msg: 'Edited successfully', guest})

//     } catch (error) {
//         console.log(error)
//         if(error.name == "JsonWebTokenError")
//             return res.status(400).send({status: 'error', msg: 'Invalid token'})

//         return res.status(500).send({status: 'error', msg:'An error occured while updating the prfile'})
//     }
// })


router.post('/edit', uploader.single('profile_img'), verifyToken, async (req, res) => {
    const { fullname, email, phone_no, address, gender, profile_img_url, profile_img_id } = req.body

    try {
        let guest = await Guest.findById(req.user._id, {
            fullname: 1,
            email: 1,
            phone_no: 1,
            address: 1,
            gender: 1,
            profile_img_id: 1,
            profile_img_url: 1
        })

        if (!guest)
            return res.status(404).send({ status: 'error', msg: 'Guest not found' })

        // Default existing image data
        let final_img_id = guest.profile_img_id
        let final_img_url = guest.profile_img_url

        // === Option 1: If new file uploaded ===
        if (req.file) {
            // Delete previous image if exists
            if (guest.profile_img_id) {
                await cloudinary.uploader.destroy(guest.profile_img_id);
            }

            // Upload new image
            const upload = await cloudinary.uploader.upload(req.file.path, {
                folder: "guest-images"
            });

            final_img_id = upload.public_id;
            final_img_url = upload.secure_url;
        }

        // === Option 2: If image info passed directly in body ===
        else if (profile_img_url) {
            // If both id and url passed, use both
            final_img_id = profile_img_id || guest.profile_img_id
            final_img_url = profile_img_url
        }

        // === Update guest info ===
        guest = await Guest.findByIdAndUpdate(
            guest._id,
            {
                fullname: fullname || guest.fullname,
                email: email || guest.email,
                phone_no: phone_no || guest.phone_no,
                address: address || guest.address,
                gender: gender || guest.gender,
                profile_img_id: final_img_id,
                profile_img_url: final_img_url
            },
            { new: true }
        ).lean()

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            guest
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



// endpoint to view profile
router.post('/view', verifyToken, async(req, res) =>{
    try {
        const guest = await Guest.findById(req.user._id).lean()
        if(!guest)
            return res.status(200).send({status: 'ok', msg: 'No Guest Found'})

        return res.status(200).send({status: 'ok', msg: 'success', guest})
        
    } catch (error) {
        console.log(error)
        if(error.name == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'Error occured'})
    }
})


module.exports = router