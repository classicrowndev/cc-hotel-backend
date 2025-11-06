const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Hall = require("../../models/hall")
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


// Add a new hall (Only Owner/Admin)
router.post("/add", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { name, type, price, capacity, description, amenities, availability } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'], 'hall')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add halls.' })
    }

    try {
        let images = []

        // Handle uploaded files first
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path,
                    { folder: "hall-images" })
                    images.push(
                        { img_id: upload.public_id, img_url: upload.secure_url }
                )
            }
        }

        // Handle JSON images sent in the request body
        let bodyImages = []
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

        const newHall = new Hall({
            name,
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

        await newHall.save()
        return res.status(200).send({ status: "success", msg: "Hall added successfully", newHall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
    }
        return res.status(500).send({ status: "error", msg: "Failed to add hall", error: e.message })
    }
})


// Update hall details (Only Owner/Admin)
router.post("/update", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { id, ...updateData } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Hall ID are required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'hall')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update hall details.' })
    }
    
    try {
        const hall = await Hall.findById(id)
        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall not found" })
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary first
            if (hall.images && hall.images.length > 0) {
                for (const img of hall.images) {
                    await cloudinary.uploader.destroy(img.img_id)
                }
            }

            // Upload new ones
            const uploadedImages = []
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'hall-images' })
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url })
            }

            updateData.images = uploadedImages
        }

        updateData.timestamp = Date.now()
        const updatedHall = await Hall.findByIdAndUpdate(id, updateData, { new: true })

        if (!updatedHall) {
            return res.status(404).send({ status: "error", msg: "Hall not found" })
        }

        return res.status(200).send({ status: "success", msg: "Hall updated successfully", updatedHall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to update hall", error: e.message })
    }
})


// View all halls (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'hall')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "hall" task
        if (req.user.role === "Staff" && req.user.task !== "hall") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to hall operations." })
        }

        const halls = await Hall.find().sort({ createdAt: -1 })
        if (!halls.length) {
            return res.status(200).send({ status: "ok", msg: "No halls found" })
        }

        return res.status(200).send({ status: "success", count: halls.length, halls })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching halls", error: e.message })
    }
})


// View a specific hall (Owner/Admin or Assigned Staff)
router.post("/view", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Hall ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'hall')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "hall") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to hall operations." })
        }

        const hall = await Hall.findById(id)
        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall not found" })
        }
        return res.status(200).send({ status: "success", hall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching hall", error: e.message })
    }
})


// Delete a hall (Only Owner/Admin)
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Hall ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'hall')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can delete hall.' })
    }

    try {
        const deletedHall = await Hall.findByIdAndDelete(id)
        if (!deletedHall) {
            return res.status(404).send({ status: "error", msg: "Hall not found or already deleted" })
        }

        return res.status(200).send({ status: "success", msg: "Hall deleted successfully", deletedHall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to delete hall", error: e.message })
    }
})

module.exports = router