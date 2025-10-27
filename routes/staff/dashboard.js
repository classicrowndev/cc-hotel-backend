const express = require('express')
const router = express.Router()

const jwt = require('jsonwebtoken')

// Import models
const Room = require('../models/room')
const Staff = require('../models/staff')
const Guest = require('../models/guest')
const ServiceRequest = require('../models/serviceRequest')
const Order = require('../models/order')

// Dashboard Overview + Recent Activities
router.post('/overview', async (req, res) => {
    const { token } = req.body

    if (!token)
        return res.status(400).send({ status: 'error', msg: 'Token must be provided' })

    try {
        // Verify staff token
        const staff = jwt.verify(token, process.env.JWT_SECRET)

        // Restrict dashboard access to Owner & Admin
        if (!['Owner', 'Admin'].includes(staff.role)) {
            return res.status(400).send({ status: 'error', msg: 'Access denied: insufficient privileges' })
        }

        // ROOM STATISTICS
        const totalRooms = await Room.countDocuments()
        const availableRooms = await Room.countDocuments({ availability: 'Available' })
        const occupiedRooms = await Room.countDocuments({ availability: 'Occupied' })
        const reservedRooms = await Room.countDocuments({ availability: 'Reserved' })
        const maintainedRooms = await Room.countDocuments({ availability: 'Maintained' })

        // GENERAL COUNTS
        const totalGuests = await Guest.countDocuments()
        const totalStaff = await Staff.countDocuments()
        const totalRequests = await ServiceRequest.countDocuments()
        const pendingRequests = await ServiceRequest.countDocuments({ status: 'Pending' })
        const completedRequests = await ServiceRequest.countDocuments({ status: 'Completed' })
        const cancelledRequests = await ServiceRequest.countDocuments({ status: 'Cancelled' })

        // RECENT SERVICE REQUESTS (latest 5)
        const recentRequests = await ServiceRequest.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('guest', 'fullname email')
            .populate('service', 'name service_type')

        // RECENT GUESTS (latest 5)
        const recentGuests = await Guest.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('fullname email room status createdAt')

        // Prepare response data
        const responseData = {
            summary: {
                rooms: {
                    total: totalRooms,
                    available: availableRooms,
                    occupied: occupiedRooms,
                    reserved: reservedRooms,
                    maintained: maintainedRooms
                },
                guests: totalGuests,
                staff: totalStaff,
                services: {
                    total: totalRequests,
                    pending: pendingRequests,
                    completed: completedRequests,
                    cancelled: cancelledRequests
                }
            },
            recentActivity: {
                recentServiceRequests: recentRequests,
                recentGuests: recentGuests
            }
        }

        // REVENUE TRACKING (Only for Owner and Admin)
        if (['Owner', 'Admin'].includes(staff.role)) {
            const allRequests = await ServiceRequest.find()
            const totalRevenue = allRequests.reduce((sum, r) => sum + (r.amount || 0), 0)
            const completedRevenue = allRequests
                .filter(r => r.status === 'Completed')
                .reduce((sum, r) => sum + (r.amount || 0), 0)
            const pendingRevenue = allRequests
                .filter(r => r.status === 'Pending')
                .reduce((sum, r) => sum + (r.amount || 0), 0)
            const cancelledRevenue = allRequests
                .filter(r => r.status === 'Cancelled')
                .reduce((sum, r) => sum + (r.amount || 0), 0)

            responseData.revenue = {
                totalRevenue,
                completedRevenue,
                pendingRevenue,
                cancelledRevenue
            }

            // ✅ ORDER ANALYTICS SECTION
            const totalOrders = await Order.countDocuments()

            // Aggregate total revenue from orders
            const totalOrderRevenueAgg = await Order.aggregate([
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
            const totalOrderRevenue = totalOrderRevenueAgg[0]?.total || 0

            // Count orders by status
            const orderStatusCounts = await Order.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ])

            // Daily order revenue (for charts)
            const dailyOrderRevenue = await Order.aggregate([
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$order_date" }
                        },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { _id: -1 } },
                { $limit: 7 }
            ])

            responseData.orders = {
                totalOrders,
                totalOrderRevenue,
                orderStatusCounts,
                dailyOrderRevenue
            }
        }

        // RETURN DASHBOARD DATA
        return res.status(200).send({
            status: 'success',
            msg: 'Dashboard overview fetched successfully',
            data: responseData
        })
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
            return res.status(400).send({ status: 'error', msg: 'Invalid token', error: e.message })
        }
        return res.status(500).send({ status: 'error', msg: 'Error fetching dashboard data', error: e.message })
    }
})

module.exports = router