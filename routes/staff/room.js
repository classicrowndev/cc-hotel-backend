const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Room = require("../../models/room")
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false

    return true // Explicitly allow if no condition blocks access
}

// ------------------------------------
// Room Management - Staff Route
// ------------------------------------


// Add a new room (Only Owner/Admin)
router.post("/add", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { name, category, type, price, capacity, description, amenities, availability } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add rooms.' })
    }

    try {
        let images = []

        // Handle uploaded files first
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path,
                    { folder: "room-images" })
                    images.push(
                        { img_id: upload.public_id, img_url: upload.secure_url }
                )
            }
        }

        // Handle JSON images sent in the request body
        let bodyImages = [];
        if (req.body.images) {
            try {
                // If images are sent as JSON string, parse it
                bodyImages = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
            } catch (err) {
                return res.status(400).send({ status: "error", msg: "Invalid format for images", error: err.message });
            }

            if (Array.isArray(bodyImages) && bodyImages.length > 0) {
                for (const img of bodyImages) {
                    if (img.img_id && img.img_url) {
                        images.push({ img_id: img.img_id, img_url: img.img_url });
                    }
                }
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
            images, // attach upload
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
router.post("/update", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { id, ...updateData } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Room ID are required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update room details.' })
    }
    
    try {
        const room = await Room.findById(id)
        if (!room) {
            return res.status(404).send({ status: "error", msg: "Room not found" })
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary first
            if (room.images && room.images.length > 0) {
                for (const img of room.images) {
                    await cloudinary.uploader.destroy(img.img_id)
                }
            }

            // Upload new ones
            const uploadedImages = []
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'room-images' })
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url })
            }

            updateData.images = uploadedImages
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
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'room')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "room" task
        if (req.user.role === "Staff" && req.user.task !== "room") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to room operations." })
        }

        // Get category from request body (or default to All)
        const { category } = req.body
        const filter = {}

        if (category && category !== "All") {
            filter.category = category  // filter by category
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

        return res.status(200).send({ status: "success", msg: "Room deleted successfully", deletedRoom })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to delete room", error: e.message })
    }
})

module.exports = router