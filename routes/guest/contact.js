const express = require("express")
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const verifyToken = require('../../middleware/verifyToken') // your middleware
const Contact = require("../../models/contact")
const nodemailer = require("nodemailer")


// Guest sends a message (contact form)
router.post("/send", verifyToken, async (req, res) => {
    const { name, email, message } = req.body

    if (!name || !email || !message) {
        return res.status(400).send({ status: "error", msg: "All fields are required." })
    }

    try {
        // Save message to DB
        const newMessage = new Contact({
            user: guest._id,
            name,
            email,
            message,
            createdAt: Date.now()
        })
        
        await newMessage.save()

        // Send email notification to hotel admin
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        })
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL, // hotel admin email stored in .env
            subject: `New Inquiry from ${name}`,
            html: `
              <h3>New Guest Message</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Message:</strong> ${message}</p>
              <hr/>
              <p>Sent on: ${new Date().toLocaleString()}</p>
            `
        }

        await transporter.sendMail(mailOptions);

        return res.status(200).send({ status: "success", msg: "Message sent successfully. Our support team will reach out soon."})
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." })
        }
        return res.status(500).send({ status: "error", msg: "Failed to send message.", error: e.message })
    }
})


// Guest views all their past messages
router.post("/all", verifyToken, async (req, res) => {
    try {
        const messages = await Contact.find({ user: guest._id })
        .sort({ createdAt: -1 }).select("name email message createdAt")

        if (!messages.length) {
            return res.status(200).send({ status: "ok", msg: "No messages found for this guest." })
        }

        return res.status(200).send({ status: "success", msg: "Messages retrieved successfully.", messages })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." })
        } return res.status(500).send({ status: "error", msg: "Failed to fetch messages.", error: e.message })
    }
})

module.exports = router
