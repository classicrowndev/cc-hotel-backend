const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Service = require("../../models/service")
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


// Add a new service (Only Owner or Admin)
router.post("/add", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { service_type, name, description, price, status, image } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new service.' })
    }

    try {
        let images = []
        
        // Handle uploaded files first
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path,{ 
                    folder: "service-images" 
                })
        
                // Upload thumbnail
                const thumb = await cloudinary.uploader.upload(file.path, {
                    folder: 'service-images-thumbs',
                    crop: 'fill',
                    width: 200,
                    height: 200,
                    quality: 'auto'
                })
                            
                images.push(
                    { img_id: upload.public_id, img_url: upload.secure_url,
                        thumb_id: thumb.public_id, thumb_url: thumb.secure_url
                    }
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
        
        const newService = new Service({
            service_type,
            name,
            description,
            price,
            status: status || "Available",
            image,
            timestamp: Date.now()
        })

        await newService.save()
        return res.status(200).send({ status: "ok", msg: "success", newService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update service details (Only Owner & Admin)
router.post("/update", verifyToken, uploader.array('images', 5), async (req, res) => {
    const { id, ...updateData } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "Service ID is required" })

    if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update service details.' })
    }

    try {
        const service = await Service.findById(id)
        if (!service) {
            return res.status(404).send({ status: "error", msg: "Service not found" })
        }
        
        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary first
            if (service.images && service.images.length > 0) {
                for (const img of service.images) {
                    await cloudinary.uploader.destroy(img.img_id)
                }
            }
                
            // Upload new ones
            const uploadedImages = []
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'service-images' })
        
                // Generate thumbnail URL (on the fly using Cloudinary URL transformation)
                const thumbUrl = upload.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill/')
        
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url,
                    thumb_url: thumbUrl // can send to the frontend only
                })
            }
                
            updateData.images = uploadedImages
        }
        
        updateData.timestamp = Date.now()
        const updatedService = await Service.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedService) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", msg: "success", updatedService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View all services (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
   if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "service" task
        if (req.user.role === "Staff" && req.user.task !== "service") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service operations." })
        }

        const services = await Service.find().sort({ timestamp: -1 })
        if (services.length === 0) return res.status(200).send({ status: "ok", msg: "No services found" })

        return res.status(200).send({ status: "ok", msg: 'success', count: services.length, services })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View a specific service (Owner/Admin or Assigned Staff)
router.post("/view", verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "Service ID are required" })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "service" task
        if (req.user.role === "Staff" && req.user.task !== "service") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service operations." })
        }

        const service = await Service.findById(id)
        if (!service) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", msg: 'success', service })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Delete a service (Only Owner or Admin)
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "Service ID are required" })

    if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can delete service details.' })
    }

    try {
        const deletedService = await Service.findByIdAndDelete(id)
        if (!deletedService) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", msg: "success", deletedService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router