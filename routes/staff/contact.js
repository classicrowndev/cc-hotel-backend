const express = require("express")
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const jwt = require("jsonwebtoken")
const Contact = require("../../models/contact") // Messages (staff & guest)
const nodemailer = require("../utils/nodemailer")

// Staff sends a message
router.post("/send", async (req, res) => {
    const { token, name, email, message } = req.body

    if (!token || !name || !email || !message) {
        return res.status(400).send({ status: "error", msg: "All fields are required." })
    }

    try {
        // verify staff token
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const newMessage = new Contact({
            user: staff._id,
            name,
            email,
            message,
            timestamp: Date.now()
        })

        await newMessage.save()

        // Notify admin via email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        })

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New Staff Message from ${name}`,
            html: `
              <h3>New Staff Message</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Message:</strong> ${message}</p>
              <hr/>
              <p>Sent on: ${new Date().toLocaleString()}</p>
            `
        };

        await transporter.sendMail(mailOptions)

        return res.status(200).send({ status: "success", msg: "Message sent successfully. Admin will respond soon." })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." })
        }
        return res.status(500).send({ status: "error", msg: "Failed to send message.", error: e.message })
    }
})


// Staff views their own messages
router.post("/all", async (req, res) => {
    const { token } = req.body

    if (!token) return res.status(400).send({ status: "error", msg: "Token must be provided." })

    try {
        // verify staff token 
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        const messages = await Contact.find({ user: staff._id }).sort({ timestamp: -1 })
            .select("name email message timestamp")

        if (!messages.length) return res.status(200).send({ status: "ok", msg: "No messages found for this staff member." })

        return res.status(200).send({ status: "success", msg: "Messages retrieved successfully.", messages })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." })
        }
        return res.status(500).send({ status: "error", msg: "Failed to fetch messages.", error: e.message })
    }
})

// Staff views all guest messages
router.get("/guest-messages", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(400).send({ status: "error", msg: "Token must be provided." });

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET);

        const guestMessages = await Contact.find({}) // optionally filter by role='guest' if you track roles
            .sort({ timestamp: -1 })
            .select("name email message timestamp");

        if (!guestMessages.length) return res.status(200).send({ status: "ok", msg: "No guest messages found." });

        return res.status(200).send({ status: "success", msg: "Guest messages retrieved successfully.", guestMessages });

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." });
        }
        return res.status(500).send({ status: "error", msg: "Failed to fetch guest messages.", error: e.message });
    }
});

// Staff replies to a guest message
router.post("/reply", async (req, res) => {
    const { token, messageId, replyMessage } = req.body;

    if (!token || !messageId || !replyMessage) {
        return res.status(400).send({ status: "error", msg: "All fields are required." });
    }

    try {
        const staff = jwt.verify(token, process.env.JWT_SECRET);

        // Only allow certain roles to reply
        if (!["Receptionist", "Manager", "Admin"].includes(staff.role)) {
            return res.status(403).send({ status: "error", msg: "You are not authorized to reply to guest messages." });
        }

        const guestMessage = await Contact.findById(messageId);
        if (!guestMessage) return res.status(404).send({ status: "error", msg: "Guest message not found." });

        // Save the reply as a new Contact entry (could also make a separate Reply model)
        const reply = new Contact({
            user: staff._id,
            name: staff.name,
            email: guestMessage.email, // send back to guest
            message: replyMessage,
            timestamp: Date.now()
        });

        await reply.save();

        // Notify guest via email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: guestMessage.email,
            subject: `Reply from Hotel Staff`,
            html: `
              <h3>Reply from Hotel Staff</h3>
              <p><strong>Message:</strong> ${replyMessage}</p>
              <hr/>
              <p>Sent on: ${new Date().toLocaleString()}</p>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).send({ status: "success", msg: "Reply sent to guest successfully." });

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Token verification failed." });
        }
        return res.status(500).send({ status: "error", msg: "Failed to send reply.", error: e.message });
    }
});

module.exports = router