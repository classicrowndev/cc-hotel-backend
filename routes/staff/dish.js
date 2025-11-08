const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const Dish = require('../../models/dish')
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')


//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired)
        return false
    return true
}


// -----------------------------
// Staff Dish Management Routes
// -----------------------------


// Add new dish (Owner/Admin only)
router.post('/add', verifyToken, uploader.array('images', 5), async (req, res) => {
    const { name, category, amount_per_portion, isReady, quantity } = req.body
    if (!name || !category || amount_per_portion === undefined) {
        return res.status(400).send({ status: 'error', msg: 'Name, category and amount_per_portion are required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Owner/Admin can add new dish.' })
    }

    try {
        let images = []

        // Handle uploaded files first
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path,
                    { folder: "dish-images" })
                    images.push(
                        { img_id: upload.public_id, img_url: upload.secure_url }
                )
            }
        }

        // Handle JSON images sent in the request body
        let bodyImages = [];
        if (req.body.images) {
            try {
                // If images are sent as JSON string, parse it
                bodyImages = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
            } catch (err) {
                return res.status(400).send({ status: "error", msg: "Invalid format for images", error: err.message });
            }

            if (Array.isArray(bodyImages) && bodyImages.length > 0) {
                for (const img of bodyImages) {
                    if (img.img_id && img.img_url) {
                        images.push({ img_id: img.img_id, img_url: img.img_url });
                    }
                }
            }
        }

        const dish = new Dish({
            name,
            category,
            isReady: isReady === 'true' || isReady === true, // converts string "true" to boolean
            quantity: quantity ?? 0,
            amount_per_portion,
            images, // attach upload
            date_added: Date.now(),
            timestamp: Date.now()
        })

        await dish.save()
        return res.status(200).send({ status: 'ok', msg: 'success', dish })
    } catch (e) {
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

        return res.status(200).send({ status: 'ok', count: dishes.length, dishes })
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

        return res.status(200).send({ status: 'ok', dish })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update dish (Owner/Admin only)
router.post('/update', verifyToken, uploader.array('images', 5), async (req, res) => {
    const { id, ...updateData } = req.body
    if (!id) {
        return res.status(400).send({ status: 'error', msg: 'Dish ID is required' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin'], 'dish')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied. Only Admin or Owner can update dish details.' })
    }


    try {
        const dish = await Dish.findById(id)
        if (!dish) {
            return res.status(404).send({ status: "error", msg: "Dish not found" })
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            // Delete old images from Cloudinary first
            if (dish.images && dish.images.length > 0) {
                for (const img of dish.images) {
                    await cloudinary.uploader.destroy(img.img_id)
                }
            }
        
            // Upload new ones
            const uploadedImages = []
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: 'dish-images' })
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url })
            }
        
            updateData.images = uploadedImages
        }

        updateData.timestamp = Date.now()
        const updatedDish = await Dish.findByIdAndUpdate(id, updateData, { new: true })
        if (!updatedDish) {
            return res.status(404).send({ status: 'error', msg: 'Dish not found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', dish: updatedDish })
    } catch (e) {
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

        return res.status(200).send({ status: 'ok', overview: { total, available, unavailable, total_drinks }})
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
            $or: [{ name: { $regex: keyword, $options: 'i' } }, { category: { $regex: keyword, $options: 'i' } }]
        }).sort({ date_added: -1 })

        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes match your search' })
        }

        return res.status(200).send({ status: 'ok', count: dishes.length, dishes })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router