const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Hall = require("../../models/hall")
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true // Explicitly allow if no condition blocks access
}


// ------------------------------------
// Room Management - Staff Route
// ------------------------------------


// Add a new hall (Only Owner/Admin)
router.post("/add", verifyToken, uploader.any(), async (req, res) => {
    try {
        const { name, type, price, capacity, description, amenities, availability } = req.body

        if (!checkRole(req.user, ['Owner', 'Admin'], 'hall')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add halls.' })
        }

        const uploadedImages = []

        // Strictly use uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, {
                    folder: "hall-images"
                })

                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
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
            images: uploadedImages,
            createdAt: Date.now(),
            timestamp: Date.now()
        })

        await newHall.save()
        return res.status(200).send({ status: "ok", msg: "success", file: uploadedImages, newHall })
    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update hall details (Only Owner/Admin)
router.post("/update", verifyToken, uploader.any(), async (req, res) => {
    try {
        const { id, name, type, price, capacity, description, amenities, availability } = req.body
        if (!id) {
            return res.status(400).send({ status: "error", msg: "Hall ID is required" })
        }

        if (!checkRole(req.user, ['Owner', 'Admin'], 'hall')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update hall details.' })
        }

        let hall = await Hall.findById(id)
        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall not found" })
        }

        const uploadedImages = []

        // If new images are uploaded, replace all old ones
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            if (hall.images && hall.images.length > 0) {
                for (const img of hall.images) {
                    try {
                        await cloudinary.uploader.destroy(img.img_id)
                    } catch (err) {
                        console.error("Cloudinary delete error:", err)
                    }
                }
            }

            // Upload new ones
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'hall-images' })
                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
            hall.images = uploadedImages
        }

        // Update other fields
        hall.name = name || hall.name
        hall.type = type || hall.type
        hall.price = price || hall.price
        hall.capacity = capacity || hall.capacity
        hall.description = description || hall.description
        hall.amenities = amenities || hall.amenities
        hall.availability = availability || hall.availability
        hall.timestamp = Date.now()

        await hall.save()

        return res.status(200).send({
            status: "ok",
            msg: "success",
            file: uploadedImages.length > 0 ? uploadedImages : undefined,
            updatedHall: hall
        })
    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
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

        return res.status(200).send({ status: "ok", msg: 'success', count: halls.length, halls })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
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
        return res.status(200).send({ status: "ok", msg: 'success', hall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
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

        return res.status(200).send({ status: "ok", msg: "success", deletedHall })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router