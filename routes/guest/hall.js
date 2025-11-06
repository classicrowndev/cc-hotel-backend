const express = require('express')
const router = express.Router()

const Hall = require('../../models/hall')



//View all halls (with optional fiter & search)
router.post('/all', async(req, res) => {
    try {
        //Fetch all halls
        const halls = await Hall.find()

        if (halls.length === 0) {
            return res.status(200).send({status: "ok", msg: "No halls at the moment"})
        }

        return res.status(200).send({status: 'ok', halls})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve halls', error: e.message})
    }  
})


// View a single hall by ID
router.post('/view', async(req, res) => {
    const {id} = req.body

    if(!id) {
        return res.status(400).send({status: 'error', msg: 'Hall ID must be provided'})
    }

    try {
        //Find hall by ID
        const hall = await Hall.findById(id)
        
        if (!hall) {
            return res.status(400).send({status: "error", msg: "Hall not found"})
        }
        return res.status(200).send({status: 'ok', hall})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve the hall', error: e.message})
    }  
})


// View only available halls
router.post('/available', async(req, res) => {
    try {
        //Find hall by ID
        const halls = await Hall.find({ availability: "Available" })

        if (halls.length === 0) {
            return res.status(200).send({status: "ok", msg: "No available halls at the moment"})
        }
        return res.status(200).send({status: 'ok', halls})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve available halls', error: e.message})
    }  
})


// View halls by type
router.post('/type', async(req, res) => {
    const {type} = req.body

    if(!type) {
        return res.status(400).send({status: 'error', msg: 'Hall type must be provided'})
    }

    try {
        //Find hall by type
        const halls = await Hall.find({type})
        
        if (halls.length === 0) {
            return res.status(200).send({status: "ok", msg: `No halls found for type: ${type}`})
        }
        return res.status(200).send({status: 'ok', halls})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve halls', error: e.message})
    }  
})


// Search halls
router.post('/search', async(req, res) => {
    const { search } = req.body

    console.log(req.body);


    if (!search) {
        return res.status(400).send({status:'error', msg: 'Search term is required'})
    }

    try {
        // Find the halls
        const halls = await Hall.find({
            $or: [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ]
        }).select('type price capacity amenities description')

        if (!halls || halls.length === 0) {
            return res.status(200).send({ status: 'ok', msg: "No halls matched your search" })
        }

        return res.status(200).send({status: 'ok', halls})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error searching halls', error: e.message})
    }  
})


module.exports = router