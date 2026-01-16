const express = require('express')
const router = express.Router()
const Inventory = require('../../models/inventory')
const verifyToken = require('../../middleware/verifyToken')
const { updateInventoryStatus } = require('../../middleware/inventory')
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')

// Get inventory statistics based on type
router.post("/stats", verifyToken, async (req, res) => {
    const { type } = req.body // room, kitchen, assets, office
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const totalItems = await Inventory.countDocuments({ type })
        const totalStockValue = await Inventory.aggregate([
            { $match: { type } },
            { $group: { _id: null, total: { $sum: { $multiply: ["$stock", "$price"] } } } }
        ])

        const lowStockItems = await Inventory.countDocuments({ type, status: "Low Stock" })
        const outOfStockItems = await Inventory.countDocuments({ type, status: "Out of Stock" })

        res.status(200).send({
            status: "ok",
            msg: "success",
            stats: {
                totalItems,
                totalValue: totalStockValue.length > 0 ? totalStockValue[0].total : 0,
                lowStock: lowStockItems,
                outOfStock: outOfStockItems
            }
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Get all unique categories for an inventory type
router.post("/categories", verifyToken, async (req, res) => {
    const { type } = req.body
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const categories = await Inventory.distinct("category", { type })
        res.status(200).send({ status: "ok", msg: "success", categories })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View all inventory items (Filtered by Type with Pagination)
router.post("/all", verifyToken, async (req, res) => {
    const { type, page = 1, limit = 20, category } = req.body
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const query = { type }
        if (category && category !== "All") query.category = category

        const count = await Inventory.countDocuments(query)
        const items = await Inventory.find(query)
            .sort({ last_updated: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean()

        // Calculate total_value for each item for the UI
        const formattedItems = items.map(item => ({
            ...item,
            total_value: (item.stock || 0) * (item.price || 0)
        }))

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            items: formattedItems
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Add new inventory item
router.post("/add", verifyToken, uploader.any(), async (req, res) => {
    const { name, type, category, location, description, unit_of_measurement, stock, price } = req.body
    if (!name || !type || !category) {
        return res.status(400).send({ status: "error", msg: "Required fields: name, type, category" })
    }

    try {
        const itemData = {
            name,
            type,
            category,
            location: location || '',
            description: description || '',
            unit_of_measurement: unit_of_measurement || 'units',
            stock: Number(stock) || 0,
            price: Number(price) || 0,
            timestamp: Date.now()
        }

        if (req.files && req.files.length > 0) {
            const file = req.files[0]
            const upload = await cloudinary.uploader.upload(file.path, { folder: "inventory-images" })
            itemData.image = {
                img_id: upload.public_id,
                img_url: upload.secure_url
            }
        }

        const item = new Inventory(itemData)
        updateInventoryStatus(item)
        await item.save()

        res.status(200).send({ status: "ok", msg: "success", item })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Update inventory item
router.post("/update", verifyToken, uploader.any(), async (req, res) => {
    const { id, name, location, description, unit_of_measurement, category, stock, price } = req.body
    if (!id) return res.status(400).send({ status: "error", msg: "Item ID is required" })

    try {
        const item = await Inventory.findById(id)
        if (!item) return res.status(404).send({ status: "error", msg: "Item not found" })

        item.name = name || item.name
        item.location = location || item.location
        item.description = description || item.description
        item.unit_of_measurement = unit_of_measurement || item.unit_of_measurement
        item.category = category || item.category
        if (stock !== undefined) item.stock = Number(stock)
        if (price !== undefined) item.price = Number(price)
        item.last_updated = Date.now()

        if (req.files && req.files.length > 0) {
            if (item.image && item.image.img_id) {
                await cloudinary.uploader.destroy(item.image.img_id).catch(e => console.error("Cloudinary delete error:", e))
            }
            const file = req.files[0]
            const upload = await cloudinary.uploader.upload(file.path, { folder: "inventory-images" })
            item.image = {
                img_id: upload.public_id,
                img_url: upload.secure_url
            }
        }

        updateInventoryStatus(item)
        await item.save()
        res.status(200).send({ status: "ok", msg: "success", item })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Delete inventory item
router.post("/delete", verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: "error", msg: "Item ID is required" })

    try {
        const item = await Inventory.findById(id)
        if (!item) return res.status(404).send({ status: "error", msg: "Item not found" })

        if (item.image && item.image.img_id) {
            await cloudinary.uploader.destroy(item.image.img_id).catch(e => console.error("Cloudinary delete error:", e))
        }

        await Inventory.findByIdAndDelete(id)
        res.status(200).send({ status: "ok", msg: "success" })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Search inventory (with Pagination)
router.post("/search", verifyToken, async (req, res) => {
    const { query, type, page = 1, limit = 20 } = req.body
    if (!query || !type) return res.status(400).send({ status: "error", msg: "Search query and type are required" })

    try {
        const searchRegex = { $regex: query, $options: "i" }
        const baseQuery = {
            type,
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { location: searchRegex },
                { category: searchRegex }
            ]
        }

        const count = await Inventory.countDocuments(baseQuery)
        const items = await Inventory.find(baseQuery)
            .sort({ last_updated: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean()

        // Calculate total_value for each item
        const formattedItems = items.map(item => ({
            ...item,
            total_value: (item.stock || 0) * (item.price || 0)
        }))

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            items: formattedItems
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

module.exports = router