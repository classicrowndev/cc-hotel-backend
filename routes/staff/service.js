const express = require('express')
const router = express.Router()

const jwt = require("jsonwebtoken")
const Service = require("../../models/service")

// Add a new service (Only Manager or Admin)
router.post("/add", async (req, res) => {
    const { token, service_type, name, description, price, availability, status, image } = req.body

    if (!token) return res.status(400).send({ status: "error", msg: "Token must be provided" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const staffRole = decoded.role
        if (!["Manager", "Admin"].includes(staffRole)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const newService = new Service({
            service_type,
            name,
            description,
            price,
            availability: availability ?? true,
            status: status || "Available",
            image,
            timestamp: Date.now()
        })

        await newService.save()
        return res.status(200).send({ status: "ok", msg: "Service added successfully", newService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to add service", error: e.message })
    }
})

// Update service details (Manager & Admin full update; Receptionist limited)
router.post("/update", async (req, res) => {
    const { token, id, ...updateData } = req.body

    if (!token || !id) return res.status(400).send({ status: "error", msg: "Token and service ID are required" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const staffRole = decoded.role
        if (staffRole === "Receptionist") {
            // Receptionists can only update availability and status
            const allowedFields = ["availability", "status"]
            for (let key in updateData) {
                if (!allowedFields.includes(key)) delete updateData[key]
            }
        } else if (!["Manager", "Admin"].includes(staffRole)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const updatedService = await Service.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedService) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", msg: "Service updated successfully", updatedService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to update service", error: e.message })
    }
})


// View all services (All staff roles with login)
router.post("/all", async (req, res) => {
    const { token } = req.body

    if (!token) return res.status(400).send({ status: "error", msg: "Token must be provided" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Manager", "Receptionist", "Concierge",
            "Guest Relations Officer", "IT", "Event Coordinator"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const services = await Service.find().sort({ timestamp: -1 })
        if (services.length === 0) return res.status(200).send({ status: "ok", msg: "No services found" })

        return res.status(200).send({ status: "ok", total: services.length, services })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to fetch services", error: e.message })
    }
})


// View a specific service (All staff roles with login)
router.post("/view", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) return res.status(400).send({ status: "error", msg: "Token and service ID are required" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Manager", "Receptionist", "Concierge",
            "Guest Relations Officer", "IT", "Event Coordinator"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const service = await Service.findById(id)
        if (!service) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", service })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to fetch service", error: e.message })
    }
})

// Delete a service (Only Manager or Admin)
router.post("/delete", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) return res.status(400).send({ status: "error", msg: "Token and service ID are required" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const staffRole = decoded.role
        if (!["Manager", "Admin"].includes(staffRole)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const deletedService = await Service.findByIdAndDelete(id)
        if (!deletedService) return res.status(404).send({ status: "error", msg: "Service not found" })

        return res.status(200).send({ status: "ok", msg: "Service deleted successfully", deletedService })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Failed to delete service", error: e.message })
    }
})

module.exports = router