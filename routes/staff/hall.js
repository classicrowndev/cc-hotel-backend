const express = require("express")
const router = express.Router()

const jwt = require("jsonwebtoken")
const nodemailer = require("../utils/nodemailer")
const Hall = require("../models/hall")

const dotenv = require("dotenv")
dotenv.config()

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})


// Add a new hall booking (staff-side)
router.post("/add", async (req, res) => {
    const { token, guest, email, hall_type, location, amount, duration, checkInDate, checkOutDate } = req.body

    if (!token || !guest || !email || !hall_type || !amount || !duration || !checkInDate || !checkOutDate) {  
        return res.status(400).send({ status: "error", msg: "All required fields must be provided" })
    }


    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

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

        // Send confirmation email to the guest
        const mailOptions = {
            from: `"Hotel Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Hall Booking Added (Staff Confirmation)",
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Hall Booking Created ✅</h2>
                <p>Dear Guest,</p>
                <p>Your hall booking has been created successfully by our staff.</p>
                <ul>
                    <li><b>Hall Type:</b> ${hall_type}</li>
                    <li><b>Location:</b> ${location || "Not specified"}</li>
                    <li><b>Amount:</b> ₦${amount}</li>
                    <li><b>Duration:</b> ${duration}</li>
                    <li><b>Check-In:</b> ${new Date(checkInDate).toDateString()}</li>
                    <li><b>Check-Out:</b> ${new Date(checkOutDate).toDateString()}</li>
                </ul>
                <p>Status: <b>Booked</b></p>
                <p>We look forward to hosting your event!</p>
                <br/>
                <p>Warm regards,<br/>The Hotel Management Team</p>
             </div>
            `
        }
        
        await transporter.sendMail(mailOptions)
        
        res.status(200).json({ status: "success", 
            msg: " Hall Booking added successfully and email sent", hall })
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: err.message })
        }
        res.status(500).send({ status: "error", msg: "Error adding hall booking", error: err.message })
    }
})


// View all hall bookings
router.post("/all", async (req, res) => {
    const { token } = req.body
    if (!token) {
        return res.status(400).send({ status: "error", msg: "Token must be provided" })
    }
    
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
        const halls = await HallBooking.find().sort({ timestamp: -1 })
        if (!halls.length) {
            return res.status(200).send({ status: 'ok', msg: 'No halls found' })
        }

        return res.status(200).send({ status: 'success', halls })
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(400).json({ status: "error", msg: "Invalid token", error: err.message })
        }
        return res.status(500).json({ status: "error", msg: "Error fetching hall bookings", error: err.message })
    }
})


// View a specific hall booking
router.post("/view", async (req, res) => {
    const { token, id } = req.body

    if (!token || !id) {
        return res.status(400).json({ status: "error", msg: "All required fields are required" })
    }
    
    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
        
        // fetch the hall document
        const hall = await Hall.findById(id)

        if (!hall) {
            return res.status(404).send({ status: "error", msg: "Hall Booking not found" })
        }

        return res.status(200).send({ status: "success", hall })
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
             return res.status(400).send({ status: "error", msg: "Invalid token", error: err.message })
        }
        return res.status(500).send({ status: "error", msg: "Error fetching hall booking", error: err.message })
    }
})


// Update a booking
router.post("/update", async (req, res) => {
    const { token, id, ...updateFields } = req.body
    if (!token || !id) {
        return res.status(400).send({ status: "error", msg: "All fields are required" })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)

        // Confirm if this hall booking record exists
        const updatedHall = await Hall.findByIdAndUpdate(id, updateFields, { new: true })

        if (!updatedHall) {
            return res.status(400).send({ status: "error", msg: "Hall Booking not found" })
        }
        
        return res.status(200).send({ status: "success", msg: "Booking updated successfully", updatedHall })
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: err.message })
        }
        return res.status(500).send({ status: "error", msg: "Error updating hall booking", error: err.message })
    }
})


// Cancel a booking
router.post("/cancel", async (req, res) => {
    const { token, id } = req.body
    if (!token || !id) {
        return res.status(400).json({ status: "error", msg: "Token and booking ID are required" })
    }

    try {
        // verify the staff's token
        jwt.verify(token, process.env.JWT_SECRET)
    
        // fetch the hall 
        const hall = await Hall.findById(id)

        if (!hall) {
            return res.status(400).send({ status: "error", msg: "Hall Booking not found" })
        }

        hall.status = "Cancelled"
        await hall.save()

        // Send cancellation email to the guest
        const mailOptions = {
            from: `"Hotel Management" <${process.env.EMAIL_USER}>`,
            to: booking.email,
            subject: "Hall Booking Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Booking Cancelled ❌</h2>
                    <p>Dear Guest,</p>
                    <p>Your hall booking for <b>${booking.hall_type}</b> has been cancelled by our staff.</p>
                    <p>If you believe this is a mistake, please contact the management team.</p>
                    <br/>
                    <p>Warm regards,<br/>The Hotel Management Team</p>
                </div>
            `
        }
        
        await transporter.sendMail(mailOptions)

        return res.status(200).send({ status: "success", msg: "Hall Booking cancelled successfully and email sent", hall })
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: err.message })
        }
        return res.status(500).send({ status: "error", msg: "Error cancelling booking", error: err.message })
    }
})

module.exports = router