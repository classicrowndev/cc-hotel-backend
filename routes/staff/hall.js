const express = require("express")
const router = express.Router()

const dotenv = require("dotenv")
dotenv.config()

const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer");
const Hall = require("../../models/hall")

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})


// -----------------------------
// STAFF HALL MANAGEMENT ROUTES
// -----------------------------


// Create a new hall booking (Admin & Owner only)
router.post("/create", async (req, res) => {
    const { token, guest, email, hall_type, location, amount, duration, checkInDate, checkOutDate } = req.body
    if (!token || !guest || !email || !hall_type || !amount || !duration || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: "error", msg: "All required fields must be provided" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can create hall bookings.' })
        }

        // If the client approves assigned staff to create hall bookings
        /*if (decoded.role === 'Staff' && decoded.task !== 'hall') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to hall operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }
        */

        const hall = new Hall({
            guest,
            email,
            hall_type,
            location,
            amount,
            duration,
            checkInDate,
            checkOutDate,
            timestamp: Date.now()
        })

        await hall.save()

        const mailOptions = {
            from: `"Hotel Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Hall Booking Confirmation",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Hall Booking Created</h2>
                    <p>Dear Guest,</p>
                    <p>Your hall booking has been created successfully.</p>
                    <ul>
                        <li><b>Hall Type:</b> ${hall_type}</li>
                        <li><b>Location:</b> ${location || "Not specified"}</li>
                        <li><b>Amount:</b> ₦${amount}</li>
                        <li><b>Duration:</b> ${duration}</li>
                        <li><b>Check-In:</b> ${new Date(checkInDate).toDateString()}</li>
                        <li><b>Check-Out:</b> ${new Date(checkOutDate).toDateString()}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>Warm regards,<br/>The Hotel Management Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)
        return res.status(200).send({ status: "success", msg: "Hall booking added successfully", hall })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error adding hall booking", error: e.message })
    }
})


// View all halls (Admin, Owner, or assigned staff)
router.post("/all", async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token is required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'hall') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to hall operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const halls = await Hall.find().sort({ timestamp: -1 })
        if (!halls.length) {
            return res.status(200).send({ status: "ok", msg: "No hall bookings found" })
        }

        return res.status(200).send({ status: "success", halls })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching hall bookings", error: e.message })
    }
})


// View specific hall booking
router.post("/view", async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and hall ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (decoded.role === 'Staff' && decoded.task !== 'hall') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to hall operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }

        const hall = await Hall.findById(id)
        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall booking not found" })
        }

        return res.status(200).json({ status: "success", hall })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching hall booking", error: e.message })
    }
})


// Update hall booking (Admin & Owner only)
router.post("/update", async (req, res) => {
    const { token, id, ...updateFields } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and hall ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ 
                status: 'error', msg: 'Access denied. Only Admin or Owner can update hall bookings'
            })
        }


        // If the client approves assigned staff to update hall bookings
        /*if (decoded.role === 'Staff' && decoded.task !== 'hall') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to hall operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }
        */


        const updatedHall = await Hall.findByIdAndUpdate(id, updateFields, { new: true })
        if (!updatedHall) {
            return res.status(404).send({ status: "error", msg: "Hall booking not found" })
        }

        return res.status(200).send({ status: "success", msg: "Hall booking updated successfully", updatedHall })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error updating hall booking", error: e.message })
    }
})


// Cancel hall booking (Admin & Owner only)
router.post("/cancel", async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "Token and hall ID are required" })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!['Admin', 'Owner'].includes(decoded.role)) {
            return res.status(403).send({ 
                status: 'error', 
                msg: 'Access denied. Only Admin or Owner can cancel hall booking.' 
            })
        }


        // If the client approves assigned staff to cancel hall bookings
        /*if (decoded.role === 'Staff' && decoded.task !== 'hall') {
            return res.status(403).send({ status: 'error', msg: 'Access denied: not assigned to hall operations' })
        }

        const allowedRoles = ['Owner', 'Admin', 'Staff']
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).send({ status: 'error', msg: 'Unauthorized role.' })
        }
        */


        const hall = await Hall.findById(id)
        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall booking not found" })
        }

        hall.status = "Cancelled"
        await hall.save()

        const mailOptions = {
            from: `"Hotel Management" <${process.env.EMAIL_USER}>`,
            to: hall.email,
            subject: "Hall Booking Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Booking Cancelled</h2>
                    <p>Dear Guest,</p>
                    <p>Your hall booking for <b>${hall.hall_type}</b> has been cancelled by our management team.</p>
                    <p>If you believe this is a mistake, please contact the hotel administration.</p>
                    <br/>
                    <p>Warm regards,<br/>The Hotel Management Team</p>
                </div>
            `
        }

        await transporter.sendMail(mailOptions)
        return res.status(200).send({ status: "success", msg: "Hall booking cancelled successfully and email sent", hall })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Token verification failed', error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error cancelling hall booking", error: e.message })
    }
})


module.exports = router