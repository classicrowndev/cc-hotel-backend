const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Room = require("../../models/room")
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}


// ------------------------------------
// Room Management - Staff Route
// ------------------------------------


// Add a new room (Only Owner/Admin)
router.post("/add", verifyToken, uploader.any(), async (req, res) => {
    try {
        const { name, category, type, price, capacity, description, amenities, availability } = req.body

        if (!checkRole(req.user, ['Owner', 'Admin'], 'room')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add rooms.' })
        }

        const uploadedImages = []

        // Strictly use uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, {
                    folder: "room-images"
                })

                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
        }

        const newRoom = new Room({
            name,
            category,
            type,
            price,
            capacity,
            description,
            amenities,
            availability: availability || "Available",
            images: uploadedImages,
            createdAt: Date.now(),
            timestamp: Date.now()
        })

        await newRoom.save()
        return res.status(200).send({ status: "ok", msg: "success", file: uploadedImages, newRoom })
    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update room details (Only Owner/Admin)
router.post("/update", verifyToken, uploader.any(), async (req, res) => {
    try {
        const { id, name, category, type, price, capacity, description, amenities, availability } = req.body
        if (!id) {
            return res.status(400).send({ status: "error", msg: "Room ID is required" })
        }

        if (!checkRole(req.user, ['Owner', 'Admin'], 'room')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update room details.' })
        }

        let room = await Room.findById(id)
        if (!room) {
            return res.status(404).send({ status: "error", msg: "Room not found" })
        }

        const uploadedImages = []

        // If new images are uploaded, replace all old ones
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            if (room.images && room.images.length > 0) {
                for (const img of room.images) {
                    try {
                        await cloudinary.uploader.destroy(img.img_id)
                    } catch (err) {
                        console.error("Cloudinary delete error:", err)
                    }
                }
            }

            // Upload new ones
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'room-images' })
                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
            room.images = uploadedImages
        }

        // Update other fields
        room.name = name || room.name
        room.category = category || room.category
        room.type = type || room.type
        room.price = price || room.price
        room.capacity = capacity || room.capacity
        room.description = description || room.description
        room.amenities = amenities || room.amenities
        room.availability = availability || room.availability
        room.timestamp = Date.now()

        await room.save()

        return res.status(200).send({
            status: "ok",
            msg: "success",
            file: uploadedImages.length > 0 ? uploadedImages : undefined,
            updatedRoom: room
        })
    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update room status (Owner/Admin or Assigned Staff)
router.post('/update_status', verifyToken, async (req, res) => {
    const { id, availability } = req.body
    if (!id || !availability) {
        return res.status(400).send({ status: 'error', msg: 'Room ID and availability are required' })
    }

    if (!['Available', 'Booked', 'Checked-In', 'Under Maintenance'].includes(availability))
        return res.status(400).send({ status: 'error', msg: 'Invalid available status' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const updated = await Room.findByIdAndUpdate(id, { availability, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Room not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', room: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all rooms (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "room" task
        if (req.user.role === "Staff" && req.user.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        const rooms = await Room.find().sort({ createdAt: -1 })
        if (!rooms.length) {
            return res.status(200).send({ status: "ok", msg: "No rooms found" })
        }

        return res.status(200).send({ status: "ok", msg: 'success', count: rooms.length, rooms })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View a specific room (Owner/Admin or Assigned Staff)
router.post("/view", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Room ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        const room = await Room.findById(id)
        if (!room) {
            return res.status(404).send({ status: "error", msg: "Room not found" })
        }
        return res.status(200).send({ status: "ok", msg: 'success', room })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Filter rooms (Owner/Admin or Assigned Staff)
router.post('/filter', verifyToken, async (req, res) => {
    const { category } = req.body

    //Build query dynamically
    let query = {}

    // Filter by category (e.g. "All", "Suites", "VIP", "Special Offers")
    if (category && category !== 'All') {
        query.category = category
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        const rooms = await Room.find(query).select('type description images price capacity amenities')
        if (!rooms.length) {
            return res.status(200).send({ status: 'ok', msg: 'No rooms found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', rooms, count: rooms.length })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete a room (Only Owner/Admin)
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Room ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can delete room.' })
    }

    try {
        const deletedRoom = await Room.findByIdAndDelete(id)
        if (!deletedRoom) {
            return res.status(404).send({ status: "error", msg: "Room not found or already deleted" })
        }

        return res.status(200).send({ status: "ok", msg: "success", deletedRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router