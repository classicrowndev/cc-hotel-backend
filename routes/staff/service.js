const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Service = require("../../models/service")


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


// Add a new service (Only Owner or Admin)
router.post("/add", verifyToken, async (req, res) => {
    const { service_type, name, description, price, status, image } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new service.' })
    }

    try {
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
router.post("/update", verifyToken, async (req, res) => {
    const { id, ...updateData } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "Service ID is required" })

    if (!checkRole(req.user, ['Owner', 'Admin'], 'service')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can update service details.' })
    }

    try {
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

        return res.status(200).send({ status: "ok", total: services.length, services })

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

        return res.status(200).send({ status: "ok", service })

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