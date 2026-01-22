const express = require('express')
const router = express.Router()
const InventoryCategory = require('../../models/inventoryCategory')
const verifyToken = require('../../middleware/verifyToken')

// Get all categories for a specific inventory type
router.post("/all", verifyToken, async (req, res) => {
    const { type } = req.body
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const categories = await InventoryCategory.find({ type }).sort({ timestamp: -1 })
        res.status(200).send({ status: "ok", msg: "success", categories })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Add new category
router.post("/add", verifyToken, async (req, res) => {
    const { name, type, description } = req.body
    if (!name || !type) {
        return res.status(400).send({ status: "error", msg: "Name and type are required" })
    }

    try {
        // Check for duplicate
        const existing = await InventoryCategory.findOne({ name, type })
        if (existing) return res.status(400).send({ status: "error", msg: "Category already exists for this type" })

        const category = new InventoryCategory({
            name,
            type,
            description,
            timestamp: Date.now()
        })
        await category.save()
        res.status(200).send({ status: "ok", msg: "success", category })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Delete category
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: "error", msg: "Category ID is required" })

    try {
        const deleted = await InventoryCategory.findByIdAndDelete(id)
        if (!deleted) return res.status(404).send({ status: "error", msg: "Category not found" })

        res.status(200).send({ status: "ok", msg: "success" })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


module.exports = router