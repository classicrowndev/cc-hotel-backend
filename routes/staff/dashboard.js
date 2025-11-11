const express = require('express')
const router = express.Router()

const verifyToken = require('../../middleware/verifyToken')

const Room = require('../../models/room')
const Staff = require('../../models/staff')
const Guest = require('../../models/guest')
const ServiceRequest = require('../../models/serviceRequest')
const Order = require('../../models/order')
const Event = require('../../models/event')

// Role checker
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff'], taskRequired = null) => {
    if (!allowedRoles.includes(user.role)) return false
    if (user.role === 'Staff' && taskRequired && user.task !== taskRequired) return false
    return true
}

// DASHBOARD + STATISTICS + REVENUE OVERVIEW
router.post('/overview', verifyToken, async (req, res) => {
    try {
        // Restrict dashboard access to Owner & Admin
        if (!checkRole(req.user, ['Owner', 'Admin'])) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        // ROOM STATISTICS
        const totalRooms = await Room.countDocuments()
        const availableRooms = await Room.countDocuments({ availability: 'Available' })
        const checkedInRooms = await Room.countDocuments({ availability: 'Checked-In' })
        const bookedRooms = await Room.countDocuments({ availability: 'Booked' })
        const maintainedRooms = await Room.countDocuments({ availability: 'Under Maintenance' })

        // GENERAL COUNTS
        const totalGuests = await Guest.countDocuments()
        const signedUpGuests = await Guest.countDocuments({ isRegistered: true })
        const totalStaff = await Staff.countDocuments()
        const totalAdmins = await Staff.countDocuments({ role: 'Admin' })

        // SERVICE REQUEST STATISTICS
        const totalRequests = await ServiceRequest.countDocuments()
        const pendingRequests = await ServiceRequest.countDocuments({ status: 'Pending' })
        const inProgressRequests = await ServiceRequest.countDocuments({ status: 'In Progress' })
        const completedRequests = await ServiceRequest.countDocuments({ status: 'Completed' })
        const cancelledRequests = await ServiceRequest.countDocuments({ status: 'Cancelled' })

        // EVENT STATISTICS
        const totalEvents = await Event.countDocuments()
        const upcomingEvents = await Event.countDocuments({ date: { $gte: new Date() } })
        const pastEvents = await Event.countDocuments({ date: { $lt: new Date() } })
        const eventRevenueAgg = await Event.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
        const totalEventRevenue = eventRevenueAgg[0]?.total || 0


        // RECENT ACTIVITIES
        const recentRequests = await ServiceRequest.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('guest', 'fullname email')
            .populate('service', 'name service_type')

        const recentGuests = await Guest.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('fullname email room status createdAt')


        // REVENUE & ORDERS SECTION
        const allRequests = await ServiceRequest.find()
        const totalRevenue = allRequests.reduce((sum, r) => sum + (r.amount || 0), 0)
        const completedRevenue = allRequests.filter(r => r.status === 'Completed')
            .reduce((sum, r) => sum + (r.amount || 0), 0)
        const pendingRevenue = allRequests.filter(r => r.status === 'Pending')
            .reduce((sum, r) => sum + (r.amount || 0), 0)
        const cancelledRevenue = allRequests.filter(r => r.status === 'Cancelled')
            .reduce((sum, r) => sum + (r.amount || 0), 0)


        // ORDER ANALYTICS
        const totalOrders = await Order.countDocuments()
        const totalOrderRevenueAgg = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
        const totalOrderRevenue = totalOrderRevenueAgg[0]?.total || 0

        const orderStatusCounts = await Order.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ])

        const dailyOrderRevenue = await Order.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$order_date" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 7 }
        ])

        // MONTHLY REVENUE STATISTICS (Orders + Events)
        const monthlyOrderRevenue = await Order.aggregate([
            {
                $group: {
                    _id: { $month: "$order_date" },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id": 1 } }
        ])

        const monthlyEventRevenue = await Event.aggregate([
            {
                $group: {
                    _id: { $month: "$date" },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id": 1 } }
        ])

        const monthlyRevenue = monthlyOrderRevenue.map((m, i) => ({
            month: m._id,
            orderRevenue: m.total,
            eventRevenue: monthlyEventRevenue[i]?.total || 0,
            totalRevenue: m.total + (monthlyEventRevenue[i]?.total || 0)
        }))


        // STRUCTURE RESPONSE DATA
        const responseData = {
            summary: {
                rooms: {
                    total: totalRooms,
                    available: availableRooms,
                    checkedIn: checkedInRooms,
                    booked: bookedRooms,
                    maintained: maintainedRooms
                },
                guests: {
                    total: totalGuests,
                    signedUp: signedUpGuests || 0
                },
                staff: {
                    total: totalStaff,
                    admins: totalAdmins
                },
                services: {
                    total: totalRequests,
                    pending: pendingRequests,
                    inProgress: inProgressRequests,
                    completed: completedRequests,
                    cancelled: cancelledRequests
                },
                events: {
                    total: totalEvents,
                    upcoming: upcomingEvents,
                    past: pastEvents,
                    revenue: totalEventRevenue
                }
            },
            revenue: {
                totalRevenue,
                completedRevenue,
                pendingRevenue,
                cancelledRevenue,
                orderRevenue: totalOrderRevenue,
                eventRevenue: totalEventRevenue,
                monthlyRevenue
            },
            orders: {
                totalOrders,
                orderStatusCounts,
                dailyOrderRevenue
            },
            recentActivity: {
                recentServiceRequests: recentRequests,
                recentGuests: recentGuests
            }
        }

        // RETURN FINAL DASHBOARD DATA
        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            data: responseData
        })

    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

module.exports = router