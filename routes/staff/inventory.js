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

        // Calculate damaged stats
        const damagedStats = await Inventory.aggregate([
            { $match: { type, damaged_stock: { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    count: { $sum: "$damaged_stock" }, // total count of damaged individual units
                    value: { $sum: { $multiply: ["$damaged_stock", "$price"] } }
                }
            }
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
                outOfStock: outOfStockItems,
                damagedItems: damagedStats.length > 0 ? damagedStats[0].count : 0,
                damagedValue: damagedStats.length > 0 ? damagedStats[0].value : 0
            }
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Get categories with item counts
router.post("/categories", verifyToken, async (req, res) => {
    const { type } = req.body
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const categories = await Inventory.aggregate([
            { $match: { type } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $project: { name: "$_id", count: 1, _id: 0 } }
        ])
        res.status(200).send({ status: "ok", msg: "success", categories })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View all inventory items (Filtered by Type with Pagination)
router.post("/all", verifyToken, async (req, res) => {
    const { type, page = 1, limit = 20, category, startDate, endDate } = req.body
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const query = { type }
        if (category && category !== "All") query.category = category

        // Date Filtering
        if (startDate || endDate) {
            query.last_updated = {};
            if (startDate) query.last_updated.$gte = new Date(startDate);
            if (endDate) query.last_updated.$lte = new Date(endDate);
        }

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
    const { name, type, category, location, description, unit_of_measurement, stock, damaged_stock, supplier, price } = req.body
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
            damaged_stock: Number(damaged_stock) || 0,
            supplier: supplier || '',
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
    const { id, name, location, description, unit_of_measurement, category, stock, damaged_stock, supplier, price } = req.body
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
        if (damaged_stock !== undefined) item.damaged_stock = Number(damaged_stock)
        item.supplier = supplier || item.supplier
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
    const { query, type, page = 1, limit = 20, startDate, endDate } = req.body
    if (!query || !type) return res.status(400).send({ status: "error", msg: "Search query and type are required" })

    try {
        const searchRegex = { $regex: query, $options: "i" }
        const baseQuery = {
            type,
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { location: searchRegex },
                { category: searchRegex },
                { supplier: searchRegex }
            ]
        }

        // Date Filtering
        if (startDate || endDate) {
            baseQuery.last_updated = {};
            if (startDate) baseQuery.last_updated.$gte = new Date(startDate);
            if (endDate) baseQuery.last_updated.$lte = new Date(endDate);
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

// Export inventory to CSV
router.get("/export", verifyToken, async (req, res) => {
    const { type } = req.query
    if (!type) return res.status(400).send({ status: "error", msg: "Inventory type is required" })

    try {
        const items = await Inventory.find({ type }).lean()
        let csv = "Item,Supplier,Stock,Damaged,Units,Price per Unit,Total Value,Date Added\n"
        items.forEach(i => {
            const totalValue = (i.stock || 0) * (i.price || 0)
            const dateAdded = i.last_updated ? new Date(i.last_updated).toLocaleDateString() : 'N/A'
            csv += `${i.name},${i.supplier || 'N/A'},${i.stock},${i.damaged_stock},${i.unit_of_measurement},${i.price},${totalValue},${dateAdded}\n`
        })

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv')
        res.status(200).send(csv)
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Export failed", error: e.message })
    }
})

module.exports = router