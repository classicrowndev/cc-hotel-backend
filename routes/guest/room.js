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
        return res.status(500).send({status: 'error', msg:'Failed to retrieve rooms', error: e.message})
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
        return res.status(200).send({ status: 'success', msg: 'Rooms retrieved successfully', count: rooms.length, rooms }) 
 
    } catch (error) {
        console.error(error)
        return res.status(500).send({
            status: 'error', msg: 'An error occurred while fetching rooms', error: error.message
       })
    }
})


// Check room availability for specific dates with detailed status
router.post('/check', async (req, res) => {
    const { room_id, checkInDate, checkOutDate } = req.body

    if (!room_id || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'Room ID, check-in and check-out dates are required.' })
    }

    try {
        const room = await Room.findById(room_id)
        if (!room) {
            return res.status(404).send({ status: 'error', msg: 'Room not found.' })
        }

        // If room is not available at all (maintenance, etc.)
        if (room.availability !== 'Available') {
            return res.status(200).send({ status: 'error',  msg: `Room is currently ${room.availability}.` })
        }

        // Check for overlapping active bookings
        const overlappingBookings = await Booking.find({
            room: room._id,
            status: { $in: ['Booked', 'Checked-in'] },
            $or: [
                { checkInDate: { $lte: new Date(checkOutDate), $gte: new Date(checkInDate) } },
                { checkOutDate: { $gte: new Date(checkInDate), $lte: new Date(checkOutDate) } },
                { checkInDate: { $lte: new Date(checkInDate) }, checkOutDate: { $gte: new Date(checkOutDate) } }
            ]
        })

        if (overlappingBookings.length > 0) {
            // If already booked for the requested dates
            return res.status(200).send({ 
                status: 'error', 
                msg: 'Room is already booked for the selected dates.', 
                roomStatus: 'Booked' 
            })
        }

        // If everything is clear
        return res.status(200).send({ 
            status: 'success', 
            msg: 'Room is available for booking.', 
            roomStatus: 'Available' 
        })

    } catch (error) {
        console.error(error)
        return res.status(500).send({ 
            status: 'error', 
            msg: 'Error checking room availability.', 
            error: error.message 
        })
    }
})


module.exports = router