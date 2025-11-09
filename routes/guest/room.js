const express = require('express')
const router = express.Router()

const Room = require('../../models/room')
const verifyToken = require('../../middleware/verifyToken')
const Booking = require('../../models/booking')


//View all rooms (with optional fiter & search)
router.post('/all', async(req, res) => {
    try {
        //Fetch all available rooms
        const rooms = await Room.find()

        if (rooms.length === 0) {
            return res.status(200).send({status: "ok", msg: "No rooms available at the moment"})
        }

        return res.status(200).send({status: 'ok', count: rooms.length, rooms})
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
    const { checkInDate, checkOutDate, no_of_guests, no_of_rooms } = req.body

    if (!checkInDate || !checkOutDate || !no_of_guests || !no_of_rooms) {
        return res.status(400).send({status: 'error', msg: 'All fields must be provided'})
    }
    try {
        // Convert dates to proper Date objects
        const start = new Date(checkInDate)
        const end = new Date(checkOutDate)

        // Find rooms that are not booked during the requested dates
        const bookedRooms = await Booking.find({
            $or: [
                { checkInDate: { $lt: end }, checkOutDate: { $gt: start } } // overlaps
            ]
        }).distinct('room') // get IDs of booked rooms

        // Find all rooms that are not booked
        const availableRooms = await Room.find({
            _id: { $nin: bookedRooms },
            capacity: { $gte: no_of_guests } // optional: match guest count
        }, 'name type description price capacity availability images' )

        if (!availableRooms.length) {
            return res.status(200).send({ status: 'ok', msg: 'No available rooms for the selected dates' })
        }

        return res.status(200).send({status: 'ok', count: availableRooms.length, availableRooms})
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


// Check room availability for specific dates with detailed status
router.post('/check', verifyToken, async (req, res) => {
    const { room_id, checkInDate, checkOutDate } = req.body

    if (!room_id || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'Room ID, check-in and check-out dates are required.' })
    }

    try {
        const room = await Room.findById(room_id)
        if (!room) {
            return res.status(404).send({ status: 'error', msg: 'Room not found.' })
        }

        // If the room is permanently unavailable or under maintenance
        if (room.availability === 'Under Maintenance' || room.availability === 'Unavailable') {
            return res.status(200).send({
                status: 'error',
                msg: `Room is currently ${room.availability}.`
            })
        }

        // Normalize requested dates to cover the full day
        const requestedStart = new Date(checkInDate)
        requestedStart.setHours(0, 0, 0, 0)

        const requestedEnd = new Date(checkOutDate)
        requestedEnd.setHours(23, 59, 59, 999)

        // Check for overlapping bookings
        const overlappingBookings = await Booking.find({
            room: room._id,
            status: { $in: ['Booked', 'Checked-in'] },
            $or: [
                { checkInDate: { $lte: requestedEnd }, checkOutDate: { $gte: requestedStart } }
            ]
        })

        if (overlappingBookings.length > 0) {
            // If already booked for the requested dates
            return res.status(200).send({ 
                status: 'ok', 
                msg: 'Room is already booked.', 
                roomStatus: 'Booked' 
            })
        }

        // If everything is clear
        return res.status(200).send({ 
            status: 'ok', 
            msg: 'success', 
            roomStatus: 'Available' 
        })

    } catch (error) {
        console.error(error)
        return res.status(500).send({ 
            status: 'error', 
            msg: 'Error occurred.', 
            error: error.message 
        })
    }
})


module.exports = router