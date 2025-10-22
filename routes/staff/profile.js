const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Staff = require('../models/staff')

/*
const cloudinary = require('../utils/cloudinary')
const Uploader = require('../utils/multer')
*/

//edit profile
router.post('/edit', /*Uploader.single('image'),*/ async(req, res) =>{
    const {token, fullname, email, phone_no, address, gender} = req.body
    if(!token)
        return res.status(400).send({status: 'error', msg:'Token must be provided'})

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        let Estaff = await Staff.findById({_id: staff._id}, {fullname: 1, email: 1, phone_no: 1, address: 1, gender: 1, profile_img_id: 1, profile_img_url: 1}).lean()
        if(!Estaff)
            return res.status(200).send({status: 'ok', msg: 'No staff found'})

        /*
        let profile_img_id= "", profile_img_url = ""
        // check if guest passed in an image to upload
        if(req.file)
        // checks if there was a profile picture there before and destory
        if(Estaff.profile_img_id)
            await Cloudinary.uploader.destroy(Estaff.profile_img_id)

        //upload new picture
        const{secure_url, public_id} = await Cloudinary.uploader.upload(req.file.path, {
            folder: "staff-images",
          })
        profile_img_id = public_id
        profile_img_url = secure_url
        */
        

        //update staff document
        Estaff = await Staff.findByIdAndUpdate({_id: staff._id}, {
            fullname: fullname || Estaff.fullname,
            email: email || Estaff.email,
            phone_no: phone_no || Estaff.phone_no,
            address: address || Estaff.address,
            gender: gender || Estaff.gender,
            /*profile_img_id: profile_img_id || Estaff.profile_img_id,
            profile_img_url: profile_img_url || Estaff.profile_img_url
            */
        }, {new: true}).lean()

        return res.status(200).send({status: 'ok', msg: 'Edited successfully', Estaff})

    } catch (error) {
        console.log(error)
        if(error.name == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'An error occured while updating the prfile'})
    }
})

// endpoint to view profile
router.post('/view', async(req, res) =>{
    const {token }= req.body
    if(!token)
        return res.status(400).send({status: 'error', msg: 'Token required'})

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const Vstaff = await Staff.findById({_id: staff._id}).lean()
        if(!Vstaff)
            return res.status(200).send({status: 'ok', msg: 'No guest Found'})

        return res.status(200).send({status: 'ok', msg: 'Successful', Vstaff})
        
    } catch (error) {
        console.log(error)
        if(error.name == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'An error occured'})
    }
})


module.exports = router