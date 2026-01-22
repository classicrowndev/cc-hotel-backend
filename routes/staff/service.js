const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Service = require("../../models/service")
const ServiceRequest = require("../../models/serviceRequest")
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
router.post("/add", verifyToken, uploader.any(), async (req, res) => {
    try {
        const {
            service_type, name, secondary_name, description, price, status,
            duration_type, allow_discount, discount_min_duration, discount_percentage
        } = req.body

        if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new service.' })
        }

        const uploadedImages = []

        // Strictly use uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, {
                    folder: "service-images"
                })

                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
        }

        const newService = new Service({
            service_type,
            name,
            secondary_name,
            description,
            price,
            duration_type,
            allow_discount: allow_discount === 'true' || allow_discount === true,
            discount_min_duration,
            discount_percentage,
            status: status || "Available",
            image: uploadedImages,
            timestamp: Date.now()
        })

        await newService.save()
        return res.status(200).send({ status: "ok", msg: "success", file: uploadedImages, newService })

    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update service details (Only Owner & Admin)
router.post("/update", verifyToken, uploader.any(), async (req, res) => {
    try {
        const {
            id, service_type, name, secondary_name, description, price, status,
            duration_type, allow_discount, discount_min_duration, discount_percentage
        } = req.body

        if (!id) return res.status(400).send({ status: "error", msg: "Service ID is required" })

        if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update service details.' })
        }

        let service = await Service.findById(id)
        if (!service) {
            return res.status(404).send({ status: "error", msg: "Service not found" })
        }

        const uploadedImages = []

        // If new images are uploaded, replace all old ones
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            if (service.image && service.image.length > 0) {
                for (const img of service.image) {
                    try {
                        await cloudinary.uploader.destroy(img.img_id)
                    } catch (err) {
                        console.error("Cloudinary delete error:", err)
                    }
                }
            }

            // Upload new ones
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'service-images' })
                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
            service.image = uploadedImages
        }

        // Update other fields
        service.service_type = service_type || service.service_type
        service.name = name || service.name
        service.secondary_name = secondary_name || service.secondary_name
        service.description = description || service.description
        service.price = price || service.price
        service.duration_type = duration_type || service.duration_type

        if (typeof allow_discount !== 'undefined') {
            service.allow_discount = allow_discount === 'true' || allow_discount === true
        }
        service.discount_min_duration = discount_min_duration || service.discount_min_duration
        service.discount_percentage = discount_percentage || service.discount_percentage
        service.status = status || service.status
        service.timestamp = Date.now()

        await service.save()

        return res.status(200).send({
            status: "ok",
            msg: "success",
            file: uploadedImages.length > 0 ? uploadedImages : undefined,
            updatedService: service
        })

    } catch (e) {
        console.error(e)
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View all services (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
    const { search } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "service" task
        if (req.user.role === "Staff" && req.user.task !== "service") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service operations." })
        }

        let query = {}
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        const services = await Service.find(query).sort({ timestamp: -1 })
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

        // Compute extra stats
        const lastBooking = await ServiceRequest.findOne({ service: id }).sort({ request_date: -1 })
        const totalBookings = await ServiceRequest.countDocuments({ service: id })

        const serviceData = service.toObject()
        serviceData.last_booked = lastBooking ? lastBooking.request_date : null
        serviceData.total_bookings = totalBookings

        return res.status(200).send({ status: "ok", msg: 'success', service: serviceData })

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

// Export services to CSV (Owner/Admin or Assigned Staff)
router.post("/export", verifyToken, async (req, res) => {
    const { search } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        if (req.user.role === "Staff" && req.user.task !== "service") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service operations." })
        }

        let query = {}
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        const services = await Service.find(query).sort({ timestamp: -1 }).lean()

        // Generate CSV
        const fields = ['Name', 'Type', 'Price', 'Duration', 'Discount', 'Status']
        let csv = fields.join(',') + '\n'

        services.forEach(s => {
            const row = [
                `"${s.name}"`,
                s.service_type,
                s.price,
                s.duration_type || "",
                s.allow_discount ? `${s.discount_percentage}% (> ${s.discount_min_duration})` : "None",
                s.status
            ]
            csv += row.join(',') + '\n'
        })

        res.header('Content-Type', 'text/csv')
        res.attachment('services.csv')
        return res.send(csv)

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router