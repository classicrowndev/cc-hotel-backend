const express = require('express')
const router = express.Router()

const Room = require('../../models/room')
const verifyToken = require('../../middleware/verifyToken')



//View all rooms
router.post('/all', verifyToken, async(req, res) => {
    try {
        //Fetch all available rooms
        const rooms = await Room.find()

        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: "No rooms available at the moment"})
        }

        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Failed to retrieve notifications', error: e.message})
    }  
})

// View a single room by ID
router.post('/view', verifyToken, async(req, res) => {
    const {id} = req.body

    if(!id) {
        return res.status(400).send({status: 'error', msg: 'Room ID must be provided'})
    }

    try {
        //Find room by ID
        const room = await Room.findById({id, guest: guest._id})
        
        if (!room) {
            return res.status(400).send({status: "error", msg: "Room not found"})
        }
        return res.status(200).send({status: 'ok', room})
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Failed to retrieve the notification', error: e.message})
    }  
})


// View only available rooms
router.post('/available', verifyToken, async(req, res) => {
    try {
        //Find room by ID
        const availableRooms = await Room.find({availability: true})
        
        if (availableRooms.length === 0) {
            return res.status(200).send({status: "ok", msg: "No available rooms at the moment"})
        }
        return res.status(200).send({status: 'ok', availableRooms})
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Failed to retrieve the notification', error: e.message})
    }  
})


// View rooms by type (Standard, Deluxe, VIP, etc.)
router.post('/type', verifyToken, async(req, res) => {
    const {type} = req.body

    if(!type) {
        return res.status(400).send({status: 'error', msg: 'Room type must be provided'})
    }

    try {
        //Find room by ID
        const rooms = await Room.find({type})
        
        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: `No rooms found for type: ${type}`})
        }
        return res.status(200).send({status: 'ok', rooms})
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Failed to retrieve the notification', error: e.message})
    }  
})

module.exports = router