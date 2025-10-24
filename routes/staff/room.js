const express = require('express')
const router = express.Router()

import jwt from "jsonwebtoken"
import Room from "../../models/roomModel.js"



// Add a new room (Only Manager or Admin)
router.post("/add", async (req, res) => {
    const { token, name, type, price, capacity, description, amenities } = req.body

    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token must be provided" })
    }

    try{
        // verify staff's token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const staffRole = decoded.role

        if (staffRole !== "Manager" && staffRole !== "Admin") {
            return res.status(400).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        
        const newRoom = new Room({
            name,
            type,
            price,
            capacity,
            description,
            amenities,
            availability: availability || "Available"
        })

        await newRoom.save()

        return res.status(200).send({ status: "ok", msg: "Room added successfully", newRoom })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).json({ status: "error", msg: "Failed to add room", error: e.message })
    }
})


// Update room details (Manager & Admin have full update rights; Receptionist limited)
router.post("/update", async (req, res) => {
    const { token, id, ...updateData } = req.body

    if (!token || !id) {
      return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try{
        // verify staff token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const staffRole = decoded.role

        // Restrict by role
        if (staffRole === "Receptionist") {
            // Receptionists can only change availability
            const allowedFields = ["availability"]
            for (let key in updateData) {
                if (!allowedFields.includes(key)) delete updateData[key]
            }
        } else if (staffRole !== "Manager" && staffRole !== "Admin") {
            // Other roles have no right
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }
        
        const updatedRoom = await Room.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedRoom) {
            return res.status(400).send({ status: "error", msg: "Room not found" })
        }
        
        return res.status(200).send({ status: "ok", msg: "Room updated successfully", updatedRoom })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to update room", error: e.message })
    }
})


// View all rooms (All staff can view)
router.post("/all", async (req, res) =>  {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token must be provided" })
    }
    
    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)

        // fetch all rooms
        const rooms = await Room.find()

        if (rooms.length === 0) {
            return res.status(200).send({ status: "ok", msg: "No rooms found" })
        }

        return res.status(200).send({ status: "ok", total: rooms.length, rooms })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to retrieve rooms", error: e.message })
    }
})


// View a specific room (All staff can view)
router.post("/view", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try {
        // verify staff token
        jwt.verify(token, process.env.JWT_SECRET)
        const room = await Room.findById(id)

        if (!room) {
            return res.status(400).send({ status: "error", msg: "Room not found" })
        }

        return res.status(200).send({ status: "ok", room })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to fetch room", error: e.message })
    }
})


// Delete a room (Only Manager or Admin)
router.post("/delete", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try {
        // verify staff token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const staffRole = decoded.role

        if (staffRole !== "Manager" && staffRole !== "Admin") {
            return res.status(400).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const deletedRoom = await Room.findByIdAndDelete(id)
        if (!deletedRoom) {
            return res.status(400).send({ status: "error", msg: "Room not found" })
        }

        return res.status(200).send({ status: "ok", msg: "Room deleted successfully", deletedRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to delete room", error: e.message })
    }
})

export default router