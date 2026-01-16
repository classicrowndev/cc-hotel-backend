const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')

const Room = require('../../models/room')
const Staff = require('../../models/staff')
const Guest = require('../../models/guest')
const ServiceRequest = require('../../models/serviceRequest')
const Order = require('../../models/order')
const Event = require('../../models/event')
const Booking = require('../../models/booking')

// Role checker
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], requiredTask = null) => {
    if (!allowedRoles.includes(user.role))
        return false
    if (user.role === 'Staff' && requiredTask) {
        if (!Array.isArray(user.task) || !user.task.includes(requiredTask)) return false
    }
    return true
}

// DASHBOARD + STATISTICS + REVENUE OVERVIEW
router.post('/overview', verifyToken, async (req, res) => {
    try {
        // Restrict dashboard access to Owner & Admin (or specific staff if needed)
        if (!checkRole(req.user, ['Owner', 'Admin'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(today.getDate() + 1)

        // Helper for date ranges (Default to "This Week" - Last 7 days including today)
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - 6)


        // 1. OCCUPANCY OVERVIEW
        // Reservations: Total bookings made (or active bookings?) - UI says "170". Let's count active bookings or total in window.
        // Assuming "Reservations" means total confirmed bookings.
        const totalReservations = await Booking.countDocuments()

        // Vacant: Available Rooms
        const vacantRooms = await Room.countDocuments({ availability: 'Available' })

        // Check-in: Bookings with checkInDate === Today
        const todayCheckIns = await Booking.countDocuments({
            checkInDate: { $gte: today, $lt: tomorrow }
        })

        // Check-out: Bookings with checkOutDate === Today
        const todayCheckOuts = await Booking.countDocuments({
            checkOutDate: { $gte: today, $lt: tomorrow }
        })


        // 2. BOOKING LIST (Recent 5)
        const recentBookings = await Booking.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('guest', 'fullname email')
            .populate('room', 'name')
            .lean()

        const formattedBookings = recentBookings.map(b => ({
            id: b._id, // Format as #ID handled by frontend or here
            guest: b.guest ? b.guest.fullname : 'Unknown',
            room: b.room ? b.room.name : b.room_no || 'N/A',
            type: b.room_type || 'N/A',
            checkIn: b.checkInDate,
            checkOut: b.checkOutDate,
            status: b.status
        }))


        // 3. CHARTS DATA

        // A. RESERVATIONS (Bar Chart - This Week: Booked, Checked-out, Cancelled)
        // We will fetch last 7 days stats
        const reservationsChart = await Booking.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfWeek.getTime() }
                    // Using timestamp for "When was it made" or checkInDate? 
                    // Usually Dashboard charts show activity over time. Let's use checkInDate for "Booked/Active"?
                    // Or simply timestamp of creation for "New Reservations". 
                    // UI shows "Booked", "Checked-out", "Cancelled". This implies current status distribution over days.
                    // Let's group by Status and Date.
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$timestamp" } } },
                        status: "$status"
                    },
                    count: { $sum: 1 }
                }
            }
        ])


        // B. PLATFORM (Donut: Walk-in vs Online)
        // Since 'platform' field is missing, we infer/mock.
        // Logic: If guest has password -> Online. If not (or created by admin) -> Walk-in.
        // This requires looking up guests. For efficiency, we'll do query.
        // NOTE: This is an APPROXIMATION.
        const bookingsWithGuest = await Booking.find().populate('guest', 'password').select('guest')
        let platformOnline = 0
        let platformWalkIn = 0

        bookingsWithGuest.forEach(b => {
            if (b.guest && b.guest.password) platformOnline++
            else platformWalkIn++
        })


        // C. CLEAN-UPS (Donut: Clean, Cleaning, Laundry)
        // Clean: Rooms Available
        // Cleaning: Rooms Under Maintenance or ServiceRequest 'Room' In Progress
        // Laundry: ServiceRequest 'Laundry'

        const cleanCount = vacantRooms // "Clean" usually implies Ready to Sell

        const cleaningRequests = await ServiceRequest.countDocuments({
            status: 'In Progress', // or Pending
            // We need to check if service type is Room. 
            // Since ServiceRequest links to Service, we need aggregation lookup or assume based on something else.
            // Let's do aggregation.
        })
        // Better approach:
        const cleaningAgg = await ServiceRequest.aggregate([
            { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceInfo' } },
            { $unwind: '$serviceInfo' },
            {
                $group: {
                    _id: '$serviceInfo.service_type',
                    count: { $sum: 1 }
                }
            }
        ])

        // Extract counts from aggregation
        // Assuming service_type values are 'Room', 'Laundry' etc.
        const laundryCount = cleaningAgg.find(x => x._id === 'Laundry')?.count || 0
        // For 'Cleaning', we take 'Room' services + 'Under Maintenance' rooms?
        const roomServiceCount = cleaningAgg.find(x => x._id === 'Room')?.count || 0
        const maintenanceRooms = await Room.countDocuments({ availability: 'Under Maintenance' })

        const cleaningTotal = roomServiceCount + maintenanceRooms


        // D. REVENUE (Line Chart - Weekly)
        // Aggregating Orders + potentially Bookings
        const dailyRevenue = await Order.aggregate([
            {
                $match: {
                    order_date: { $gte: startOfWeek }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$order_date" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ])


        // 4. TASKS (Recent 3, assigned to someone? - Mock Assignee name for now as it's missing)
        const recentTasks = await ServiceRequest.find()
            .sort({ request_date: -1 })
            .limit(3)
            .populate('service', 'name service_type')
            .lean()

        const formattedTasks = recentTasks.map(t => ({
            id: t._id,
            description: `Please ${t.service.name}`, // e.g., "Please clean up room..."
            assignee: "Unassigned", // Placeholder until Assignee added
            status: t.status,
            date: t.request_date
        }))


        // STRUCTURE RESPONSE
        const responseData = {
            occupancy: {
                reservations: totalReservations,
                vacant: vacantRooms,
                checkIn: todayCheckIns,
                checkOut: todayCheckOuts
            },
            bookingList: formattedBookings,
            charts: {
                reservations: reservationsChart,
                platform: {
                    online: platformOnline,
                    walkIn: platformWalkIn
                },
                cleanUps: {
                    clean: cleanCount,
                    cleaning: cleaningTotal,
                    laundry: laundryCount
                },
                revenue: dailyRevenue
            },
            tasks: formattedTasks
        }

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            data: responseData
        })

    } catch (e) {
        console.error(e)
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router