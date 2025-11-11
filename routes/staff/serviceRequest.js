const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const ServiceRequest = require("../../models/serviceRequest")
const Service = require("../../models/service")


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


// Fetch all service requests (Owner/Admin or Assigned Staff)
router.post("/all", verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const requests = await ServiceRequest.find().populate("guest", "fullname email")
            .populate("service", "name service_type").sort({ request_date: -1 })

        if (requests.length === 0) {
            return res.status(200).send({ status: "ok", msg: "No service requests found" })
        }

        return res.status(200).send({ status: "ok", msg: 'success', count: requests.length, requests })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View a specific service request (Owner/Admin or Assigned Staff)
router.post("/view", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Request ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const request = await ServiceRequest.findById(id).populate("guest", "fullname email")
            .populate("service", "name service_type")

        if (!request) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: 'success', request })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update request status (Owner/Admin or Assigned Staff)
router.post("/update_status", verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status) {
        return res.status(400).send({ status: "error", msg: "Request ID and status are required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const updated = await ServiceRequest.findByIdAndUpdate(id, { status }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: "success", updated })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Delete a service request (Owner/Admin or Assigned Staff)
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: "error", msg: "Request ID is required" })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'serviceRequest')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }
    
    try {
        // Staff must be assigned to "serviceRequest" task
        if (req.user.role === "Staff" && req.user.task !== "serviceRequest") {
            return res.status(403).send({ status: "error", msg: "Access denied. Not assigned to service request operations." })
        }

        const deleted = await ServiceRequest.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", msg: "success", deleted })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router