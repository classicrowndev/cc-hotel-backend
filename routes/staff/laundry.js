const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')
const LaundryItem = require("../../models/laundryItem")
const LaundryBooking = require("../../models/laundryBooking")
const Guest = require("../../models/guest")
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')

// Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role)) return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// ---------------------------------------------------------
// STATS
// ---------------------------------------------------------
// Overview laundry stats (Owner/Admin/Staff)
router.post('/stats', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }
    try {
        const totalBookings = await LaundryBooking.countDocuments()
        const onlineBookings = await LaundryBooking.countDocuments({ payment_method: { $ne: 'Cash' } }) // Proxy for now
        const directBookings = await LaundryBooking.countDocuments({ payment_method: 'Cash' }) // Proxy for now

        const inProgress = await LaundryBooking.countDocuments({ status: 'In Progress' })
        const delivered = await LaundryBooking.countDocuments({ status: 'Delivered' })

        // Sum total distinct items in inventory
        const totalItems = await LaundryItem.countDocuments({ status: 'Available' })

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            stats: {
                totalBookings,
                onlineBookings,
                directBookings,
                totalItems,
                inProgress,
                delivered
            }
        })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// ---------------------------------------------------------
// ITEM MANAGEMENT
// ---------------------------------------------------------
// Add new laundry item (Owner/Admin only)
router.post('/add_items', verifyToken, uploader.any(), async (req, res) => {
    try {
        const {
            name, category, price, description, status,
            price_wash, price_iron, price_both,
            discount_percentage, discount_min_qty,
            discount_enabled // Boolean
        } = req.body
        if (!checkRole(req.user, ['Owner', 'Admin'], 'laundry')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        const uploadedImages = []
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: "laundry-images" })
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url })
            }
        }

        const newItem = new LaundryItem({
            name, category, price, description, status: status || "Available",
            price_wash: price_wash || 0,
            price_iron: price_iron || 0,
            price_both: price_both || 0,
            discount_percentage: discount_percentage || 0,
            discount_min_qty: discount_min_qty || 0,
            discount_enabled: discount_enabled === 'true' || discount_enabled === true,
            image: uploadedImages, timestamp: Date.now()
        })
        await newItem.save()
        return res.status(200).send({ status: "ok", msg: "success", item: newItem })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Update laundry item (Owner/Admin only)
router.post('/update_items', verifyToken, uploader.any(), async (req, res) => {
    try {
        const {
            id, name, category, price, description, status,
            price_wash, price_iron, price_both,
            discount_percentage, discount_min_qty,
            discount_enabled
        } = req.body
        if (!id) return res.status(400).send({ status: "error", msg: "ID required" })
        if (!checkRole(req.user, ['Owner', 'Admin'], 'laundry')) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        let item = await LaundryItem.findById(id)
        if (!item) return res.status(404).send({ status: "error", msg: "Item not found" })

        const uploadedImages = []
        if (req.files && req.files.length > 0) {
            // Delete old images logic could go here
            for (const file of req.files) {
                const upload = await cloudinary.uploader.upload(file.path, { folder: "laundry-images" })
                uploadedImages.push({ img_id: upload.public_id, img_url: upload.secure_url })
            }
            item.image = uploadedImages
        }

        item.name = name || item.name
        item.category = category || item.category
        item.price = price || item.price
        item.description = description || item.description
        item.status = status || item.status
        item.price_wash = price_wash !== undefined ? price_wash : item.price_wash
        item.price_iron = price_iron !== undefined ? price_iron : item.price_iron
        item.price_both = price_both !== undefined ? price_both : item.price_both
        item.discount_percentage = discount_percentage !== undefined ? discount_percentage : item.discount_percentage
        item.discount_min_qty = discount_min_qty !== undefined ? discount_min_qty : item.discount_min_qty
        if (discount_enabled !== undefined) item.discount_enabled = discount_enabled === 'true' || discount_enabled === true
        item.last_updated = Date.now()
        await item.save()

        return res.status(200).send({ status: "ok", msg: "success", item })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Delete laundry item (Owner/Admin only)
router.post('/delete_items', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        await LaundryItem.findByIdAndDelete(id)
        return res.status(200).send({ status: "ok", msg: "success" })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View all laundry items (Owner/Admin/Staff)
router.post('/all_items', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        const items = await LaundryItem.find().sort({ timestamp: -1 })
        return res.status(200).send({ status: "ok", msg: "success", count: items.length, items })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View single laundry item details (Owner/Admin/Staff)
router.post('/view_item', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        const item = await LaundryItem.findById(id).lean()
        if (!item) return res.status(404).send({ status: "error", msg: "Item not found" })

        // Find last booking with this item to determine last_ordered
        // items.item matches the ObjectId ref in DBSchema but in add_booking we push { item: dbItem._id ... }
        // The schema for LaundryBooking.items is { item: { type: ObjectId, ref: 'LaundryItem' } ... }
        // So we query 'items.item': id
        const lastBooking = await LaundryBooking.findOne({
            'items.item': id
        }).sort({ timestamp: -1 }).select('timestamp')

        const last_ordered = lastBooking ? lastBooking.timestamp : null

        return res.status(200).send({ status: "ok", msg: "success", item: { ...item, last_ordered } })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Export items to CSV (Owner/Admin/Staff)
router.post('/export_items', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        const items = await LaundryItem.find().sort({ timestamp: -1 }).lean()
        const fields = ['Name', 'Category', 'Price', 'Wash Price', 'Iron Price', 'Both Price', 'Discount %', 'Min Qty', 'Status', 'Date Added']
        let csv = fields.join(',') + '\n'

        items.forEach(i => {
            const row = [
                `"${i.name}"`,
                i.category,
                i.price,
                i.price_wash || 0,
                i.price_iron || 0,
                i.price_both || 0,
                `${i.discount_percentage || 0}%`,
                i.discount_min_qty || 0,
                i.status,
                i.timestamp ? new Date(i.timestamp).toISOString().split('T')[0] : ""
            ]
            csv += row.join(',') + '\n'
        })
        res.header('Content-Type', 'text/csv')
        res.attachment('laundry_items.csv')
        return res.send(csv)
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// ---------------------------------------------------------
// BOOKING MANAGEMENT
// ---------------------------------------------------------
// Create new laundry booking (Owner/Admin/Staff)
router.post('/add_bookings', verifyToken, async (req, res) => {
    const {
        guest_id, first_name, last_name, email, phone, // Guest
        items, // Array of { item_id, quantity }
        room, delivery_date, payment_method,
        laundry_type, priority,
        urgent_fee, service_charge,
        discount_enabled // Boolean
    } = req.body

    if (!items || !items.length) return res.status(400).send({ status: "error", msg: "No items selected" })
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        // Guest Logic
        let targetGuestId = guest_id
        let guestName = `${first_name} ${last_name}`

        if (!targetGuestId) {
            if (!email) return res.status(400).send({ status: "error", msg: "Guest email required" })
            let existing = await Guest.findOne({ email })
            if (existing) {
                targetGuestId = existing._id
                guestName = existing.fullname
            } else {
                const newGuest = new Guest({
                    fullname: guestName, email, phone_no: phone,
                    password: Math.random().toString(36).slice(-8),
                    status: 'Active', timestamp: Date.now()
                })
                await newGuest.save()
                targetGuestId = newGuest._id
            }
        } else {
            const g = await Guest.findById(targetGuestId)
            guestName = g ? g.fullname : "Unknown"
        }

        // Calculate Totals & Build Item List
        let finalItems = []
        let totalAmount = 0
        let totalQuantity = 0

        for (const i of items) {
            const dbItem = await LaundryItem.findById(i.item_id)
            if (dbItem) {
                const qty = i.quantity || 1
                let unitPrice = dbItem.price // Default fall back

                // Determine price based on service type string (case-insensitive)
                const type = (i.service_type || "N/A").toLowerCase()
                if (type.includes("wash") && type.includes("iron")) {
                    unitPrice = dbItem.price_both || dbItem.price
                } else if (type.includes("wash")) {
                    unitPrice = dbItem.price_wash || dbItem.price
                } else if (type.includes("iron")) {
                    unitPrice = dbItem.price_iron || dbItem.price
                }

                const lineTotal = unitPrice * qty
                totalAmount += lineTotal
                totalQuantity += qty
                finalItems.push({
                    item: dbItem._id,
                    name: dbItem.name,
                    service_type: i.service_type || "N/A",
                    quantity: qty,
                    price: unitPrice
                })
            }
        }

        // Discount Logic verifies 20+ pieces rule
        let discountAmount = 0
        if (discount_enabled && totalQuantity >= 20) {
            discountAmount = totalAmount * 0.10 // 10% of items total
            totalAmount -= discountAmount
        }

        // Add additional fees to total
        if (urgent_fee) totalAmount += Number(urgent_fee)
        if (service_charge) totalAmount += Number(service_charge)

        const paymentStatus = (payment_method && payment_method !== 'N/A') ? 'Paid' : 'Pending'

        const booking = new LaundryBooking({
            guest: targetGuestId,
            guest_name: guestName,
            email, phone, room,
            items: finalItems,
            total_amount: totalAmount,
            urgent_fee: urgent_fee || 0,
            service_charge: service_charge || 0,
            discount_enabled: (discount_enabled && totalQuantity >= 20) || false,
            discount_amount: discountAmount,
            laundry_type: laundry_type || "Mixed",
            priority: priority || "Standard",
            status: "Pending",
            payment_method: payment_method || "N/A",
            payment_status: paymentStatus,
            delivery_date,
            timestamp: Date.now()
        })
        await booking.save()

        return res.status(200).send({ status: "ok", msg: "success", booking })

    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View all laundry bookings (Owner/Admin/Staff)
router.post('/all_bookings', verifyToken, async (req, res) => {
    const { search, status, startDate, endDate } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        let query = {}
        if (status) query.status = status

        // Date Filtering
        if (startDate && endDate) {
            query.request_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        } else if (startDate) {
            query.request_date = { $gte: new Date(startDate) }
        }

        if (search) {
            query.$or = [
                { guest_name: { $regex: search, $options: 'i' } },
                { room: { $regex: search, $options: 'i' } }
            ]
        }
        const bookings = await LaundryBooking.find(query).sort({ timestamp: -1 })
        return res.status(200).send({ status: "ok", msg: "success", count: bookings.length, bookings })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Update booking status (Owner/Admin/Staff)
router.post('/update_status', verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        await LaundryBooking.findByIdAndUpdate(id, { status })
        return res.status(200).send({ status: "ok", msg: "success" })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Export bookings to CSV (Owner/Admin/Staff)
router.post('/export_bookings', verifyToken, async (req, res) => {
    // Export logic similar to others
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        const bookings = await LaundryBooking.find().sort({ timestamp: -1 }).lean()
        const fields = ['Order ID', 'Guest', 'Items', 'Amount', 'Type', 'Priority', 'Status', 'Date']
        let csv = fields.join(',') + '\n'

        bookings.forEach(b => {
            const itemSummary = b.items.map(i => `${i.quantity}x ${i.name}`).join('; ')
            const row = [
                b._id,
                `"${b.guest_name}"`,
                `"${itemSummary}"`,
                b.total_amount,
                b.laundry_type || "Mixed",
                b.priority || "Standard",
                b.status,
                b.request_date ? new Date(b.request_date).toISOString().split('T')[0] : ""
            ]
            csv += row.join(',') + '\n'
        })
        res.header('Content-Type', 'text/csv')
        res.attachment('laundry_bookings.csv')
        return res.send(csv)
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// View single booking details (Owner/Admin/Staff)
router.post('/view_booking', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        const booking = await LaundryBooking.findById(id).populate('guest')
        if (!booking) return res.status(404).send({ status: "error", msg: "Booking not found" })
        return res.status(200).send({ status: "ok", msg: "success", booking })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Delete laundry booking (Owner/Admin)
router.post('/delete_booking', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!checkRole(req.user, ['Owner', 'Admin'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    try {
        await LaundryBooking.findByIdAndDelete(id)
        return res.status(200).send({ status: "ok", msg: "success" })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Update full booking details (Owner/Admin/Staff)
router.post('/update_booking', verifyToken, async (req, res) => {
    const {
        id, items, // Array of { item_id, quantity, service_type }
        laundry_type, priority,
        urgent_fee, service_charge,
        discount_enabled, status,
        delivery_date, payment_method, room
    } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "ID required" })
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'laundry')) return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        let booking = await LaundryBooking.findById(id)
        if (!booking) return res.status(404).send({ status: "error", msg: "Booking not found" })

        // Recalculate Items if provided
        if (items && items.length > 0) {
            let finalItems = []
            let totalAmount = 0
            let totalQuantity = 0

            for (const i of items) {
                // If item has _id it might be existing, but simpler to rebuild from LaundryItem to ensure price accuracy
                // Assuming items passed are { item_id, quantity, service_type }
                const itemId = i.item_id || i.item
                const dbItem = await LaundryItem.findById(itemId)

                if (dbItem) {
                    const qty = i.quantity || 1
                    let unitPrice = dbItem.price // Default

                    // Determine price based on service type string (case-insensitive)
                    const type = (i.service_type || "N/A").toLowerCase()
                    if (type.includes("wash") && type.includes("iron")) {
                        unitPrice = dbItem.price_both || dbItem.price
                    } else if (type.includes("wash")) {
                        unitPrice = dbItem.price_wash || dbItem.price
                    } else if (type.includes("iron")) {
                        unitPrice = dbItem.price_iron || dbItem.price
                    }

                    const lineTotal = unitPrice * qty
                    totalAmount += lineTotal
                    totalQuantity += qty
                    finalItems.push({
                        item: dbItem._id,
                        name: dbItem.name,
                        service_type: i.service_type || "N/A",
                        quantity: qty,
                        price: unitPrice
                    })
                }
            }
            booking.items = finalItems

            // Re-apply discount logic
            let discountAmount = 0
            if (discount_enabled && totalQuantity >= 20) {
                discountAmount = totalAmount * 0.10
                totalAmount -= discountAmount
            }

            // Add fees
            const uFee = urgent_fee !== undefined ? Number(urgent_fee) : booking.urgent_fee
            const sCharge = service_charge !== undefined ? Number(service_charge) : booking.service_charge

            totalAmount += uFee
            totalAmount += sCharge

            booking.total_amount = totalAmount
            booking.discount_amount = discountAmount
            booking.discount_enabled = discount_enabled // Update preference
        } else {
            // Handle fee-only/status-only updates
            if (urgent_fee !== undefined || service_charge !== undefined || discount_enabled !== undefined) {
                // Re-sum existing items
                let currentItemTotal = 0
                let currentQty = 0
                booking.items.forEach(i => {
                    currentItemTotal += (i.price * i.quantity)
                    currentQty += i.quantity
                })

                let discEnabled = discount_enabled !== undefined ? discount_enabled : booking.discount_enabled
                let discAmount = 0
                if (discEnabled && currentQty >= 20) {
                    discAmount = currentItemTotal * 0.10
                    currentItemTotal -= discAmount
                }

                const uFee = urgent_fee !== undefined ? Number(urgent_fee) : booking.urgent_fee
                const sCharge = service_charge !== undefined ? Number(service_charge) : booking.service_charge

                booking.total_amount = currentItemTotal + uFee + sCharge
                booking.discount_amount = discAmount
                booking.discount_enabled = discEnabled
                booking.urgent_fee = uFee
                booking.service_charge = sCharge
            }
        }

        if (laundry_type) booking.laundry_type = laundry_type
        if (priority) booking.priority = priority
        if (status) booking.status = status
        if (payment_method) booking.payment_method = payment_method
        if (delivery_date) booking.delivery_date = delivery_date
        if (room) booking.room = room

        await booking.save()
        return res.status(200).send({ status: "ok", msg: "success", booking })
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


module.exports = router