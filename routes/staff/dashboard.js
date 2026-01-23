const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')

const Room = require('../../models/room')
const Staff = require('../../models/staff')
const Guest = require('../../models/guest')
const ServiceRequest = require('../../models/serviceRequest')
const Order = require('../../models/order')
const Event = require('../../models/event')
const Task = require('../../models/task')

// ... (imports remain)

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
        const totalReservations = await Booking.countDocuments()
        const vacantRooms = await Room.countDocuments({ availability: 'Available' })
        const todayCheckIns = await Booking.countDocuments({
            checkInDate: { $gte: today, $lt: tomorrow }
        })
        const todayCheckOuts = await Booking.countDocuments({
            checkOutDate: { $gte: today, $lt: tomorrow }
        })


        // 2. BOOKING LIST (Recent 5)
        const recentBookings = await Booking.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('guest', 'fullname email')
            .populate('rooms.room', 'name')
            .lean()

        const formattedBookings = recentBookings.map(b => ({
            id: b.booking_id || b._id,
            guest: b.guest ? b.guest.fullname : 'Unknown',
            room: b.rooms && b.rooms.length > 0 ? b.rooms[0].room_no : 'N/A', // Showing first room
            type: b.rooms && b.rooms.length > 0 ? b.rooms[0].room_type : 'N/A',
            checkIn: b.checkInDate,
            checkOut: b.checkOutDate,
            status: b.status
        }))


        // 3. CHARTS DATA

        // A. RESERVATIONS (Bar Chart - This Week)
        const reservationsChart = await Booking.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfWeek.getTime() }
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
        const onlineCount = await Booking.countDocuments({ booking_type: 'Online' })
        const directCount = await Booking.countDocuments({ booking_type: 'Direct' }) // Walk-in usually = Direct


        // C. CLEAN-UPS 
        // Logic: 
        // 'Clean' = Available Rooms
        // 'Cleaning' = Rooms with availability 'Maintenance' (or if we had a dedicated Cleaning status)
        // 'Untidy' = ServiceRequests for Room Cleaning that are pending? Or maybe 'Booked' rooms are considered needing cleaning eventually?
        // Let's stick to Room statuses + Service Requests for now.

        const cleanCount = vacantRooms // Available
        const maintenanceCount = await Room.countDocuments({ availability: 'Under Maintenance' })
        // For 'Untidy', let's sum up pending 'Room' service requests
        const untidyRequests = await ServiceRequest.aggregate([
            { $lookup: { from: 'services', localField: 'service', foreignField: '_id', as: 'serviceInfo' } },
            { $unwind: '$serviceInfo' },
            { $match: { 'serviceInfo.service_type': 'Room', status: { $in: ['Pending', 'In Progress'] } } },
            { $count: "count" }
        ])
        const untidyCount = untidyRequests.length > 0 ? untidyRequests[0].count : 0


        // D. REVENUE (Line Chart - Weekly - ORDERS + BOOKINGS)
        // 1. Orders Revenue
        const ordersRevenue = await Order.aggregate([
            { $match: { order_date: { $gte: startOfWeek } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$order_date" } }, total: { $sum: "$amount" } } }
        ])

        // 2. Bookings Revenue
        const bookingsRevenue = await Booking.aggregate([
            { $match: { timestamp: { $gte: startOfWeek.getTime() } } }, // Using creation time for revenue
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$timestamp" } } }, total: { $sum: "$amount" } } }
        ])

        // Merge Revenue
        const revenueMap = {}
        ordersRevenue.forEach(r => revenueMap[r._id] = (revenueMap[r._id] || 0) + r.total)
        bookingsRevenue.forEach(r => revenueMap[r._id] = (revenueMap[r._id] || 0) + r.total)

        const dailyRevenue = Object.keys(revenueMap).map(date => ({ _id: date, total: revenueMap[date] })).sort((a, b) => a._id.localeCompare(b._id))


        // 4. TASKS (Recent 3 from Task Model)
        const recentTasks = await Task.find()
            .sort({ timestamp: -1 })
            .limit(3)
            .populate('assignee', 'fullname profile_img_url')
            .lean()

        const formattedTasks = recentTasks.map(t => ({
            id: t._id,
            description: t.description || `Task: ${t.name}`,
            assignee: t.assignee ? t.assignee.fullname : "Unassigned",
            img: t.assignee ? t.assignee.profile_img_url : null,
            status: t.status,
            date: t.start_date || t.date_added
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
                    online: onlineCount,
                    walkIn: directCount
                },
                cleanUps: {
                    clean: cleanCount,
                    cleaning: maintenanceCount, // Maintenance
                    untidy: untidyCount // Active Room Service Requests
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