const express = require('express')
const router = express.Router()

const dotenv = require('dotenv')
dotenv.config()

const Booking = require('../../models/booking')
const Room = require('../../models/room')
const Guest = require('../../models/guest')
const verifyToken = require('../../middleware/verifyToken') // your middleware
const { sendGuestBookingMail, sendGuestBookingStatusMail } = require('../../utils/nodemailer')

//Helper to check role access
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// Create a new booking/reservation manually (Staff creates on behalf of guest)
router.post('/create', verifyToken, async (req, res) => {
    const {
        guest_id, firstname, lastname, phone, email,
        rooms, duration, no_of_guests, checkInDate, checkOutDate,
        booking_type, payment_method, payment_status
    } = req.body

    if (!email || !rooms || !rooms.length || !duration || !no_of_guests || !checkInDate || !checkOutDate) {
        return res.status(400).send({ status: 'error', msg: 'All required fields must be filled.' })
    }

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        let guest;
        // 1. Handle Guest (Existing or New)
        if (guest_id) {
            guest = await Guest.findById(guest_id)
            if (!guest) return res.status(400).send({ status: 'error', msg: 'Guest not found.' })
        } else {
            // Check if guest exists by email
            guest = await Guest.findOne({ email })
            if (!guest) {
                if (!firstname || !lastname || !phone) {
                    return res.status(400).send({ status: 'error', msg: 'Guest details (firstname, lastname, phone) are required for new guests.' })
                }
                // Create new guest
                guest = new Guest({
                    fullname: `${firstname} ${lastname}`,
                    email,
                    phone,
                    password: Math.random().toString(36).slice(-8), // Temporary password
                    joining_date: Date.now(),
                    last_booking_date: Date.now()
                })
                await guest.save()
            }
        }

        // 2. Validate Rooms and Calculate Amount
        let totalAmount = 0
        const bookingRooms = []

        for (const rId of rooms) {
            const room = await Room.findById(rId)
            if (!room) return res.status(400).send({ status: 'error', msg: `Room with ID ${rId} not found.` })

            if (room.availability !== "Available") { // Case sensitive check might be needed, strictly following model enum
                // The model says "Available" (capital A). 
                if (room.availability !== "Available")
                    return res.status(400).send({ status: 'error', msg: `Room ${room.name} is currently unavailable.` })
            }

            totalAmount += room.price * duration
            bookingRooms.push({
                room: room._id,
                room_no: room.name,
                room_type: room.type,
                price: room.price,
                status: 'Booked'
            })
        }

        // 3. Create Booking
        const booking = new Booking({
            guest: guest._id,
            email,
            rooms: bookingRooms,
            amount: totalAmount,
            duration,
            no_of_guests,
            checkInDate,
            checkOutDate,
            status: 'Booked',
            booking_id: Math.floor(1000 + Math.random() * 9000).toString(),
            booking_type: booking_type || 'Direct',
            payment_method: payment_method || 'Cash',
            payment_status: payment_status || 'Pending',
            timestamp: Date.now()
        })

        await booking.save()

        // 4. Update Rooms Availability and Current Guest
        for (const rData of bookingRooms) {
            await Room.findByIdAndUpdate(rData.room, {
                availability: "Booked",
                current_guest: guest._id,
                current_booking: booking._id
            })
        }

        // 5. Update Guest last booking date
        guest.last_booking_date = Date.now()
        await guest.save()

        // 6. Send Email (using first room details for simplicity or aggregate?)
        // The mailer might need update, for now passing the first room's details or a summary
        await sendGuestBookingMail(
            guest.email,
            guest.fullname,
            bookingRooms.map(r => r.room_no).join(', '), // Passing all room names
            bookingRooms[0].room_type, // Passing first room type
            checkInDate,
            checkOutDate,
            no_of_guests,
            totalAmount
        )

        return res.status(200).send({ status: 'ok', msg: 'success', booking })
    } catch (e) {
        if (e.name === "JsonWebTokenError")
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View all bookings/reservation history (0wner/Admin/Assigned staff)
router.post('/all', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const bookings = await Booking.find()
            .populate('guest', 'fullname email phone')
            .populate('rooms.room', 'name type price availability')
            .sort({ timestamp: -1 })

        if (!bookings.length) {
            return res.status(200).send({ status: 'ok', msg: 'No bookings found' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', count: bookings.length, bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// View a single booking (0wner/Admin/Assigned staff)
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(id)
            .populate('guest', 'fullname email phone')
            .populate('rooms.room', 'name type price availability')

        if (!booking)
            return res.status(400).send({ status: 'error', msg: 'Booking not found.' })

        return res.status(200).send({ status: 'ok', msg: 'success', booking })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update booking/reservation status (0wner/Admin/Assigned staff)
router.post('/update-status', verifyToken, async (req, res) => {
    const { id, status } = req.body
    if (!id || !status)
        return res.status(400).send({ status: 'error', msg: 'All fields must be provided.' })

    const validStatuses = ['Booked', 'Checked-in', 'Checked-out', 'Cancelled', 'Overdue']
    if (!validStatuses.includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(id).populate('rooms.room')
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found.' })

        booking.status = status
        booking.timestamp = Date.now()
        await booking.save()

        if (['Checked-out', 'Cancelled'].includes(status)) {
            for (const r of booking.rooms) {
                await Room.findByIdAndUpdate(r.room, { availability: 'Available' })
            }
        }

        if (status === 'Checked-in') {
            for (const r of booking.rooms) {
                await Room.findByIdAndUpdate(r.room, { availability: 'Checked-In' }) // Assuming 'Checked-In' is the enum value
            }
        }

        // Send booking status email
        await sendGuestBookingStatusMail(
            booking.email,
            booking.guest.fullname,
            booking.rooms.map(r => r.room_no).join(', '),
            status
        )

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            booking
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Delete booking/reservation (0wner/Admin/Assigned staff)
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id)
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findByIdAndDelete(id)
        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found or already deleted.' })

        if (booking.rooms && booking.rooms.length > 0) {
            for (const r of booking.rooms) {
                await Room.findByIdAndUpdate(r.room, {
                    availability: 'Available',
                    $unset: { current_guest: "", current_booking: "" }
                })
            }
        }

        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Search bookings (0wner/Admin/Assigned staff)
router.post('/search', verifyToken, async (req, res) => {
    const { query } = req.body
    if (!query)
        return res.status(400).send({ status: 'error', msg: 'Search query is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // First, check if input matches a Guest Name (needs population)
        let guestIds = [];
        const guests = await Guest.find({ fullname: { $regex: query, $options: 'i' } }).select('_id')
        if (guests.length > 0) guestIds = guests.map(g => g._id)

        const bookings = await Booking.find({
            $or: [
                { booking_id: query }, // Exact match for short ID
                { "rooms.room_no": { $regex: query, $options: 'i' } }, // Adjusted for array
                { email: { $regex: query, $options: 'i' } },
                { guest: { $in: guestIds } }
            ]
        })
            .populate('guest', 'fullname email phone')
            .populate('rooms.room', 'name type price')
            .sort({ timestamp: -1 })

        if (!bookings.length)
            return res.status(200).send({ status: 'ok', msg: 'No bookings found' })

        return res.status(200).send({ status: 'ok', msg: 'success', bookings, count: bookings.length })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Get reservation statistics (for Room Service dashboard cards)
router.post('/stats', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const total = await Booking.countDocuments()
        const confirmed = await Booking.countDocuments({ status: 'Booked' })
        const checkedIn = await Booking.countDocuments({ status: 'Checked-in' })
        const checkedOut = await Booking.countDocuments({ status: 'Checked-out' })
        const pending = await Booking.countDocuments({ status: 'Overdue' })
        const cancelled = await Booking.countDocuments({ status: 'Cancelled' })
        const onlineReservations = await Booking.countDocuments({ booking_type: 'Online' })
        const directReservations = await Booking.countDocuments({ booking_type: 'Direct' })

        return res.status(200).send({
            status: "ok",
            msg: "success",
            stats: {
                total,
                confirmed,
                checkedIn,
                checkedOut,
                pending,
                cancelled,
                onlineReservations,
                directReservations
            }
        })
    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})


// Filter bookings (0wner/Admin/Assigned staff)
router.post('/filter', verifyToken, async (req, res) => {
    const { status, startDate, endDate } = req.body

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const query = {}
        if (status) query.status = status
        if (startDate && endDate) {
            query.checkInDate = { $gte: new Date(startDate), $lte: new Date(endDate) }
        }

        const bookings = await Booking.find(query)
            .populate('guest', 'fullname email phone')
            .populate('rooms.room', 'name type price')
            .sort({ timestamp: -1 })

        if (!bookings.length)
            return res.status(200).send({ status: 'ok', msg: 'No bookings found matching filter' })

        return res.status(200).send({ status: 'ok', msg: 'success', count: bookings.length, bookings })
    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Update booking details
router.post('/update', verifyToken, async (req, res) => {
    const { id, guest_id, email, room_id, amount, duration, no_of_guests, checkInDate, checkOutDate, status } = req.body

    if (!id) return res.status(400).send({ status: "error", msg: "Booking ID is required" })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    // Simplified Update: Only supporting basic field updates for now to avoid complex room re-validation logic in this turn if not requested.
    // If room updates are needed, it requires full logic similar to create.
    try {
        let booking = await Booking.findById(id)
        if (!booking) return res.status(404).send({ status: "error", msg: "Booking not found" })

        if (guest_id) {
            const guest = await Guest.findById(guest_id)
            if (!guest) return res.status(404).send({ status: "error", msg: "Guest not found" })
            booking.guest = guest._id
        }

        booking.email = email || booking.email
        // duration/amount recalc would differ if rooms changed. For now assuming simple updates.
        booking.duration = duration || booking.duration
        booking.no_of_guests = no_of_guests || booking.no_of_guests
        booking.checkInDate = checkInDate || booking.checkInDate
        booking.checkOutDate = checkOutDate || booking.checkOutDate
        booking.status = status || booking.status
        booking.timestamp = Date.now()

        await booking.save()
        return res.status(200).send({ status: "ok", msg: "success", booking })

    } catch (e) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({ status: "error", msg: "Invalid token", error: e.message })
        }
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Update status of a single room within a booking
router.post('/update-room-status', verifyToken, async (req, res) => {
    const { booking_id, room_id, status } = req.body

    if (!booking_id || !room_id || !status)
        return res.status(400).send({ status: 'error', msg: 'Booking ID, Room ID, and Status are required.' })

    const validStatuses = ['Booked', 'Checked-in', 'Checked-out', 'Cancelled']
    if (!validStatuses.includes(status))
        return res.status(400).send({ status: 'error', msg: 'Invalid status provided.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(booking_id)
        if (!booking) return res.status(404).send({ status: 'error', msg: 'Booking not found.' })

        // Find the specific room in the booking
        const roomIndex = booking.rooms.findIndex(r => r.room.toString() === room_id || r._id.toString() === room_id)
        if (roomIndex === -1)
            return res.status(404).send({ status: 'error', msg: 'Room not found in this booking.' })

        // Update the status of that room
        booking.rooms[roomIndex].status = status

        // Update the actual Room model availability
        const roomModel = await Room.findById(booking.rooms[roomIndex].room)
        if (roomModel) {
            if (status === 'Checked-in') {
                roomModel.availability = 'Checked-In' // Matching Room model enum
            } else if (['Checked-out', 'Cancelled'].includes(status)) {
                roomModel.availability = 'Available'
            } else if (status === 'Booked') {
                roomModel.availability = 'Booked'
            }
            await roomModel.save()
        }

        booking.markModified('rooms')
        await booking.save()

        return res.status(200).send({ status: 'ok', msg: 'success', booking })

    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Generate Invoice Data
router.post('/invoice', verifyToken, async (req, res) => {
    const { booking_id } = req.body

    if (!booking_id)
        return res.status(400).send({ status: 'error', msg: 'Booking ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        const booking = await Booking.findById(booking_id)
            .populate('guest', 'fullname email phone address')
            .populate('rooms.room', 'name type price')

        if (!booking)
            return res.status(404).send({ status: 'error', msg: 'Booking not found.' })

        // Construct Invoice Object
        const invoice = {
            hotel_name: "Classic Crown Hotel",
            hotel_address: "123 Hotel Street, City, Country", // Validate if this should be dynamic
            invoice_number: `INV-${booking.booking_id || booking._id.toString().slice(-6).toUpperCase()}`,
            issue_date: new Date().toISOString(),
            due_date: booking.payment_status === 'Paid' ? null : new Date().toISOString(), // Immediate due if not paid?
            status: booking.payment_status,
            guest: {
                name: booking.guest.fullname,
                email: booking.guest.email,
                phone: booking.guest.phone,
                address: booking.guest.address || "N/A"
            },
            booking_details: {
                booking_id: booking.booking_id,
                check_in: booking.checkInDate,
                check_out: booking.checkOutDate,
                duration: booking.duration,
                guests: booking.no_of_guests
            },
            line_items: [],
            subtotal: 0,
            tax: 0, // Logic for tax can be added here
            grand_total: 0
        }

        // Generate Line Items
        booking.rooms.forEach(r => {
            if (r.room) { // Ensure room exists (populated)
                const lineTotal = r.price * booking.duration
                invoice.line_items.push({
                    description: `Room Charge - ${r.room.name} (${r.room.type})`,
                    quantity: booking.duration, // Days
                    unit_price: r.price,
                    total: lineTotal
                })
                invoice.subtotal += lineTotal
            }
        })

        // Add any extra services fees if tracked? For now just rooms.

        invoice.grand_total = invoice.subtotal // + tax
        // Integrity check: invoice.grand_total should broadly match booking.amount 
        // (Booking.amount might have been manually set or includes discounts not tracked here yet)
        // For consistency, we might prioritize booking.amount if it differs, or show calculated. 
        // Let's rely on calculated line items for the invoice breakdown.

        return res.status(200).send({ status: 'ok', msg: 'success', invoice })

    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


// Export bookings to CSV (Owner/Admin or assigned staff)
router.post('/export_bookings', verifyToken, async (req, res) => {
    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }
    try {
        const bookings = await Booking.find().populate('guest', 'fullname').populate('rooms.room', 'name type').sort({ timestamp: -1 }).lean()
        const fields = ['Booking ID', 'Guest Name', 'Amount', 'Duration', 'No. of Guests', 'Rooms', 'Date Reserved', 'Check-in', 'Check-out', 'Status']
        let csv = fields.join(',') + '\n'

        bookings.forEach(b => {
            const roomNames = b.rooms ? b.rooms.map(r => r.room_no).join('; ') : 'N/A'
            const row = [
                b.booking_id ? `#${b.booking_id}` : (b._id.toString().slice(-4)),
                `"${b.guest ? b.guest.fullname : 'N/A'}"`,
                b.amount,
                b.duration ? `${b.duration} days` : '',
                b.no_of_guests,
                `"${roomNames}"`,
                b.timestamp ? new Date(b.timestamp).toISOString().split('T')[0] : "",
                b.checkInDate ? new Date(b.checkInDate).toISOString().split('T')[0] : "",
                b.checkOutDate ? new Date(b.checkOutDate).toISOString().split('T')[0] : "",
                b.status
            ]
            csv += row.join(',') + '\n'
        })

        res.header('Content-Type', 'text/csv')
        res.attachment('reservations.csv')
        return res.send(csv)
    } catch (e) {
        return res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Get booking history for a specific room
router.post('/room-history', verifyToken, async (req, res) => {
    const { room_id } = req.body

    if (!room_id)
        return res.status(400).send({ status: 'error', msg: 'Room ID is required.' })

    if (!checkRole(req.user, ['Owner', 'Admin', 'Staff'], 'booking')) {
        return res.status(403).send({ status: 'error', msg: 'Access denied or unauthorized role.' })
    }

    try {
        // Find bookings where the room array contains the room_id
        const bookings = await Booking.find({ "rooms.room": room_id })
            .populate('guest', 'fullname')
            .sort({ timestamp: -1 })
            .lean()

        if (!bookings.length)
            return res.status(200).send({ status: 'ok', msg: 'No history found for this room', history: [] })

        // Format for the UI table
        const history = bookings.map(b => ({
            booking_id: b.booking_id,
            guest: b.guest ? b.guest.fullname : 'N/A',
            amount: b.amount, // Note: This is total booking amount, not necessarily room specific portion unless calculated
            date_reserved: b.timestamp
        }))

        return res.status(200).send({ status: 'ok', msg: 'success', history })

    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid or expired token.' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router