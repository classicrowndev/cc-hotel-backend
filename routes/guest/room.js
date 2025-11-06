const express = require('express')
const router = express.Router()

const Room = require('../../models/room')



//View all rooms (with optional fiter & search)
router.post('/all', async(req, res) => {
    try {
        //Fetch all available rooms
        const rooms = await Room.find()

        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: "No rooms available at the moment"})
        }

        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve rooms', error: e.message})
    }  
})


// View a single room by ID
router.post('/view', async(req, res) => {
    const {id} = req.body

    if(!id) {
        return res.status(400).send({status: 'error', msg: 'Room ID must be provided'})
    }

    try {
        //Find room by ID
        const room = await Room.findById(id)
        
        if (!room) {
            return res.status(400).send({status: "error", msg: "Room not found"})
        }
        return res.status(200).send({status: 'ok', room})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve the room', error: e.message})
    }  
})


// View only available rooms
router.post('/available', async(req, res) => {
    try {
        //Find room by ID
        const rooms = await Room.find({ availability: "available" })

        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: "No available rooms at the moment"})
        }
        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve available rooms', error: e.message})
    }  
})


// View rooms by type (Standard, Deluxe, VIP, etc.)
router.post('/type', async(req, res) => {
    const {type} = req.body

    if(!type) {
        return res.status(400).send({status: 'error', msg: 'Room type must be provided'})
    }

    try {
        //Find room by type
        const rooms = await Room.find({type})
        
        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: `No rooms found for type: ${type}`})
        }
        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Failed to retrieve rooms', error: e.message})
    }  
})


// Search rooms
router.post('/search', async(req, res) => {
    const { search } = req.body

    if (!search) {
        return res.status(400).send({status:'error', msg: 'Search term is required'})
    }

    try {
        // Find the rooms
        const rooms = await Room.find({
            $or: [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ]
        }).select('type price capacity amenities description')

        if (!rooms || rooms.length === 0) {
            return res.status(200).send({ status: 'ok', msg: "No rooms matched your search" })
        }

        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error searching rooms', error: e.message})
    }  
})


// Filter rooms
router.post('/filter', async (req, res) => {
    const { category } = req.body

    //Build query dynamically
    let query = {}

    // Filter by category (e.g. "All", "Suites", "VIP", "Special Offers")
    if (category && category !== 'All') {
        query.category = category
    }

    try {
        const rooms = await Room.find(query).select('name type description images price capacity amenities')
        if (!rooms.length) {
            return res.status(200).send({ status: 'ok', msg: 'No rooms match the filter' })
        }

        return res.status(200).send({ status: 'ok', rooms })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error filtering rooms', error: e.message })
    }
})

module.exports = router