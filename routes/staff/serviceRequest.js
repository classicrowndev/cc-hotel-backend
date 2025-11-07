const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')
const ServiceRequest = require("../../models/serviceRequest")
const Service = require("../../models/service")


// Fetch all service requests
router.post("/all", async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token is required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Manager", "Receptionist", "Concierge"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const requests = await ServiceRequest.find().populate("guest", "fullname email")
            .populate("service", "name service_type").sort({ request_date: -1 })

        if (requests.length === 0) {
            return res.status(200).send({ status: "ok", msg: "No service requests found" })
        }

        return res.status(200).send({ status: "ok", requests })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View a specific service request
router.post("/view", async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and request ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Receptionist", "Concierge"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
        }

        const request = await ServiceRequest.findById(id).populate("guest", "fullname email")
            .populate("service", "name service_type")

        if (!request) {
            return res.status(404).send({ status: "error", msg: "Service request not found" })
        }

        return res.status(200).send({ status: "ok", request })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update request status
router.post("/update_status", async (req, res) => {
    const { token, id, status } = req.body
    if (!token || !id || !status) {
        return res.status(400).send({ status: "error", msg: "Token, request ID, and status are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Manager", "Receptionist", "Concierge"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
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


// Delete a service request
router.post("/delete", async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and request ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const allowedRoles = ["Admin", "Manager"]
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: "error", msg: "Access denied. Unauthorized role." })
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