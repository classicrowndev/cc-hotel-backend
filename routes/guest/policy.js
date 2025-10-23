const express = require("express")
const router = express.Router()

import Policy from "../models/policy.js"

// Fetch all policies (e.g. Privacy Policy, Terms of Service)
router.post("/all", async (req, res) => {
    try {
        const policies = await Policy.find().sort({ timestamp: -1 })

        return res.status(200).send({ status: "ok", msg: "Policies retrieved successfully", policies })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Failed to fetch policies", error: e.message })
    }
})

// Fetch a specific policy by ID or title
router.post("/view", async (req, res) => {
    try {
        const { id, title } = req.body

        if (!id && !title) {
            return res.status(400).send({ status: "error", msg: "Please provide either policy ID or title"})
        }

        let policy
        if (id) {
            policy = await Policy.findById(id)
        } else if (title) {
            policy = await Policy.findOne({ title })
        }

        if (!policy) {
            return res.status(404).send({ status: "error", msg: "Policy not found"})
        }

        return res.status(200).send({ status: "ok", policy })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Failed to fetch policy", error: e.message })
    }
})

export default router