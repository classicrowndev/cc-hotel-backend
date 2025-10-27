const express = require('express')
const router = express.Router()

const jwt = require("jsonwebtoken")
const Room = require("../models/room")



// ------------------------------------
// Room Management - Staff Route
// ------------------------------------


// Add a new room (Only Owner/Admin)
router.post("/add", async (req, res) => {
    const { token, name, type, price, capacity, description, amenities, availability } = req.body

    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token must be provided" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!["Owner", "Admin"].includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Only Owner/Admin can add rooms." })
        }

        const newRoom = new Room({
            name,
            type,
            price,
            capacity,
            description,
            amenities,
            availability: availability || "Available",
            createdAt: Date.now(),
            timestamp: Date.now()
        })

        await newRoom.save()
        return res.status(200).send({ status: "success", msg: "Room added successfully", newRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
    }
        return res.status(500).send({ status: "error", msg: "Failed to add room", error: e.message })
    }
})


// Update room details (Only Owner/Admin)
router.post("/update", async (req, res) => {
    const { token, id, ...updateData } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!["Owner", "Admin"].includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Only Owner/Admin can update rooms." })
        }

        updateData.timestamp = Date.now()
        const updatedRoom = await Room.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedRoom) {
            return res.status(404).send({ status: "error", msg: "Room not found" })
        }

        return res.status(200).send({ status: "success", msg: "Room updated successfully", updatedRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to update room", error: e.message })
    }
})


// View all rooms (Owner/Admin or Assigned Staff)
router.post("/all", async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token must be provided" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Owner", "Admin", "Staff"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Unauthorized role." })
        }

        // Staff must be assigned to "room" task
        if (decoded.role === "Staff" && decoded.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        const rooms = await Room.find().sort({ createdAt: -1 })
        if (!rooms.length) {
            return res.status(200).send({ status: "ok", msg: "No rooms found" })
        }

        return res.status(200).send({ status: "success", count: rooms.length, rooms })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching rooms", error: e.message })
    }
})


// View a specific room (Owner/Admin or Assigned Staff)
router.post("/view", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Owner", "Admin", "Staff"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Unauthorized role." })
    }

        if (decoded.role === "Staff" && decoded.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        const room = await Room.findById(id)
        if (!room){
            return res.status(404).send({ status: "error", msg: "Room not found" })
    }
        return res.status(200).send({ status: "success", room })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching room", error: e.message })
    }
})


// Delete a room (Only Owner/Admin)
router.post("/delete", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and room ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!["Owner", "Admin"].includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Only Owner/Admin can delete rooms." })
        }

        const deletedRoom = await Room.findByIdAndDelete(id)
        if (!deletedRoom) {
            return res.status(404).send({ status: "error", msg: "Room not found or already deleted" })
        }

        return res.status(200).send({ status: "success", msg: "Room deleted successfully", deletedRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to delete room", error: e.message })
    }
})

module.exports = router