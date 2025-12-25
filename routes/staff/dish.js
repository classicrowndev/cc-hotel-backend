const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Dish = require('../../models/dish')
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}


// -----------------------------
// Staff Dish Management Routes
// -----------------------------


// Add new dish (Owner/Admin only)
router.post('/add', verifyToken, uploader.any(), async (req, res) => {
    try {
        let { name, category, subCategory, amount_per_portion, isReady, quantity } = req.body

        // Case-insensitivity handling for subCategory
        if (!subCategory) {
            subCategory = req.body.subcategory || req.body.SubCategory
        }

        if (!name || !category || amount_per_portion === undefined) {
            return res.status(400).send({ status: 'error', msg: 'all fields are required' })
        }

        if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new dish.' })
        }

        const uploadedImages = []

        // Strictly use uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, {
                    folder: "dish-images"
                })

                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
        }

        const dish = new Dish({
            name,
            category,
            subCategory,
            isReady: isReady === 'true' || isReady === true,
            quantity: quantity ?? 0,
            amount_per_portion,
            images: uploadedImages,
            date_added: Date.now(),
            timestamp: Date.now()
        })

        await dish.save()
        return res.status(200).send({ status: 'ok', msg: 'success', file: uploadedImages, dish })

    } catch (e) {
        console.error(e)
        if (e.name === 'JsonWebTokenError') return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Staff can only view dishes or take orders
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const dishes = await Dish.find().sort({ date_added: -1 })
        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: dishes.length, dishes })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View single dish (Staff can view only if assigned)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const dish = await Dish.findById(id)
        if (!dish) return res.status(404).send({ status: 'error', msg: 'Dish not found' })

        return res.status(200).send({ status: 'ok', msg: 'success', dish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update dish (Owner/Admin only)
router.post('/update', verifyToken, uploader.any(), async (req, res) => {
    try {
        const { id, name, category, subCategory, amount_per_portion, isReady, quantity } = req.body

        if (!id) {
            return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
        }

        if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update dish details.' })
        }

        let dish = await Dish.findById(id)
        if (!dish) {
            return res.status(404).send({ status: "error", msg: "Dish not found" })
        }

        const uploadedImages = []

        // If new images are uploaded, replace all old ones
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary
            if (dish.images && dish.images.length > 0) {
                for (const img of dish.images) {
                    try {
                        await cloudinary.uploader.destroy(img.img_id)
                    } catch (err) {
                        console.error("Cloudinary delete error:", err)
                    }
                }
            }

            // Upload new ones
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'dish-images' })
                uploadedImages.push({
                    img_id: upload.public_id,
                    img_url: upload.secure_url
                })
            }
            dish.images = uploadedImages
        }

        // Update other fields
        dish.name = name || dish.name
        dish.category = category || dish.category
        dish.subCategory = subCategory || req.body.subcategory || req.body.SubCategory || dish.subCategory
        dish.amount_per_portion = amount_per_portion !== undefined ? amount_per_portion : dish.amount_per_portion
        dish.isReady = isReady !== undefined ? (isReady === 'true' || isReady === true) : dish.isReady
        dish.quantity = quantity !== undefined ? quantity : dish.quantity
        dish.timestamp = Date.now()

        await dish.save()

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            file: uploadedImages.length > 0 ? uploadedImages : undefined,
            dish
        })

    } catch (e) {
        console.error(e)
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete dish (Owner/Admin only)
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can delete dish.' })
    }


    try {
        const deleted = await Dish.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found or already deleted' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update dish readiness (Owner/Admin or Assigned Staff)
router.post('/update_status', verifyToken, async (req, res) => {
    const { id, isReady } = req.body
    if (!id || isReady === undefined) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID and readiness status are required' })
    }

    if (typeof isReady !== 'boolean') {
        return res.status(400).send({ status: 'error', msg: 'Invalid readiness status' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const updated = await Dish.findByIdAndUpdate(id,
            { isReady: isReady === 'true' || isReady === true, timestamp: Date.now() }, { new: true })
        if (!updated) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', dish: updated })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Overview (Staff can view if assigned, otherwise Owner/Admin)
router.post('/overview', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const total = await Dish.countDocuments()
        const available = await Dish.countDocuments({ isReady: true })
        const unavailable = await Dish.countDocuments({ isReady: false })
        const total_drinks = await Dish.countDocuments({ category: { $in: ['Bar & Drinks', 'Beverages'] } })

        return res.status(200).send({
            status: 'ok', msg: 'success',
            overview: { total, available, unavailable, total_drinks }
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


//Search (Staff can view if assigned, otherwise Owner/Admin)
router.post('/search', verifyToken, async (req, res) => {
    const { keyword } = req.body
    if (!keyword) {
        return res.status(400).send({ status: 'error', msg: 'Keyword is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const dishes = await Dish.find({
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { category: { $regex: keyword, $options: 'i' } },
                { subCategory: { $regex: keyword, $options: 'i' } }
            ]
        }).sort({ date_added: -1 })

        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: dishes.length, dishes })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router