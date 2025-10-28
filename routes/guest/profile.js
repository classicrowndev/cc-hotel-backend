const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const Guest = require('../../models/guest')

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
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        let Eguest = await Guest.findById({_id: guest._id}, {fullname: 1, email: 1, phone_no: 1, address: 1, gender: 1, profile_img_id: 1, profile_img_url: 1}).lean()
        if(!Eguest)
            return res.status(200).send({status: 'ok', msg: 'No guest found'})

        /*
        let profile_img_id= "", profile_img_url = ""
        // check if guest passed in an image to upload
        if(req.file)
        // checks if there was a profile picture there before and destory
        if(Eguest.profile_img_id)
            await Cloudinary.uploader.destroy(Eguest.profile_img_id)

        //upload new picture
        const{secure_url, public_id} = await Cloudinary.uploader.upload(req.file.path, {
            folder: "guest-images",
          })
        profile_img_id = public_id
        profile_img_url = secure_url
        */
        

        //update guest document
        Eguest = await Guest.findByIdAndUpdate({_id: guest._id}, {
            fullname: fullname || Eguest.fullname,
            email: email || Eguest.email,
            phone_no: phone_no || Eguest.phone_no,
            address: address || Eguest.address,
            gender: gender || Eguest.gender,
            /*profile_img_id: profile_img_id || Eguest.profile_img_id,
            profile_img_url: profile_img_url || Eguest.profile_img_url
            */
        }, {new: true}).lean()

        return res.status(200).send({status: 'ok', msg: 'Edited successfully', Eguest})

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
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        const Vguest = await Guest.findById({_id: guest._id}).lean()
        if(!Vguest)
            return res.status(200).send({status: 'ok', msg: 'No guest Found'})

        return res.status(200).send({status: 'ok', msg: 'Successful', Vguest})
        
    } catch (error) {
        console.log(error)
        if(error.name == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'An error occured'})
    }
})


module.exports = router