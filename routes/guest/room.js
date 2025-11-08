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
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
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
        return res.status(500).send({status: 'error', msg:'Error occured', error: e.message})
    }  
})


// View only available rooms
router.post('/available', async(req, res) => {
    try {
        //Find room by ID
        const rooms = await Room.find({ availability: "Available" })

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
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// Filter and Search Rooms
router.post('/filter', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, status, search } = req.body

        // Step 1: Build filter query for MongoDB
        const query = {}
        if (category && category.toLowerCase() !== "all") query.category = category
        if (status) query.status = status
        if (minPrice && maxPrice) query.price = { $gte: minPrice, $lte: maxPrice }
        else if (minPrice) query.price = { $gte: minPrice }
        else if (maxPrice) query.price = { $lte: maxPrice }

        // Step 2: Fetch filtered results from DB
        let rooms = await Room.find(query).lean()

        // Step 3: If a search keyword exists, search only within filtered results
        if (search && search.trim() !== '') {
            const keyword = search.toLowerCase()
            rooms = rooms.filter(room =>
                room.name?.toLowerCase().includes(keyword) ||
                room.type?.toLowerCase().includes(keyword) ||
                room.category?.toLowerCase().includes(keyword) ||
                room.description?.toLowerCase().includes(keyword)
           )
        }

        // Step 4: Handle empty results
        if (!rooms.length) {
            return res.status(200).send({ status: 'ok', msg: 'No rooms found' })
        }

        // Step 5: Send successful response
        return res.status(200).send({ status: 'ok', msg: 'success', count: rooms.length, rooms }) 
 
    } catch (error) {
        console.error(error)
        return res.status(500).send({
            status: 'error', msg: 'Error occurred', error: error.message
       })
    }
})


module.exports = router