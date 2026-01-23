const express = require('express')
const router = express.Router()
const verifyToken = require('../../middleware/verifyToken')
const Task = require('../../models/task')
const Staff = require('../../models/staff')
const checkRole = (user, allowedRoles = ['Owner', 'Admin', 'Staff']) => {
    return allowedRoles.includes(user.role)
}

// Create new task
router.post('/create', verifyToken, async (req, res) => {
    const { name, type, assignee_id, start_date, description, deadline } = req.body

    if (!name || !type || !assignee_id)
        return res.status(400).send({ status: 'error', msg: 'Name, Type, and Assignee are required.' })

    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        // Find assignee
        const staff = await Staff.findById(assignee_id)
        if (!staff) return res.status(404).send({ status: 'error', msg: 'Assignee staff not found.' })

        const newTask = new Task({
            task_id: `#${Math.floor(1000 + Math.random() * 9000)}`, // Simple ID generation
            name,
            type,
            assignee: staff._id,
            description,
            deadline: deadline ? new Date(deadline) : undefined,
            status: 'To-do',
            date_added: Date.now(),
            start_date: start_date ? new Date(start_date) : Date.now(),
            timestamp: Date.now()
        })

        await newTask.save()
        return res.status(200).send({ status: 'ok', msg: 'success', task: newTask })

    } catch (e) {
        if (e.name === 'JsonWebTokenError')
            return res.status(400).send({ status: 'error', msg: 'Invalid token' })
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Get all tasks (List) with Search, Filter & Pagination
router.post('/all', verifyToken, async (req, res) => {
    const { query, status, type, time_filter, page = 1, limit = 10 } = req.body

    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        let filter = {}

        // 1. Search Query (Task ID or Name)
        if (query) {
            filter.$or = [
                { task_id: { $regex: query, $options: 'i' } },
                { name: { $regex: query, $options: 'i' } }
            ]
        }

        // 2. Status Filter
        if (status && status !== 'All') {
            filter.status = status // Can be array or single string. Frontend usually sends string "To-do" etc.
        }

        // 3. Type Filter
        if (type && type !== 'All Tasks' && type !== 'All') {
            filter.type = type
        }

        // 4. Time Filter
        if (time_filter) {
            const now = new Date()
            let startDate
            if (time_filter === 'Today') {
                startDate = new Date(now.setHours(0, 0, 0, 0))
            } else if (time_filter === 'This Week') {
                const day = now.getDay() || 7 // Get current day number, convert Sun (0) to 7
                if (day !== 1) now.setHours(-24 * (day - 1)) // Set to Monday
                else now.setHours(0, 0, 0, 0)
                startDate = new Date(now)
            } else if (time_filter === 'This Month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            }

            if (startDate) {
                filter.timestamp = { $gte: startDate.getTime() }
            }
        }

        // Pagination
        const limitNum = parseInt(limit)
        const pageNum = parseInt(page)
        const skip = (pageNum - 1) * limitNum

        const total = await Task.countDocuments(filter)
        const tasks = await Task.find(filter)
            .populate('assignee', 'fullname profile_img_url')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            count: tasks.length,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            },
            tasks
        })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Get Task Stats for Dashboard
router.post('/stats', verifyToken, async (req, res) => {
    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        const total = await Task.countDocuments()
        const completed = await Task.countDocuments({ status: 'Completed' })
        const ongoing = await Task.countDocuments({ status: 'On-going' })
        const todo = await Task.countDocuments({ status: 'To-do' })

        return res.status(200).send({
            status: 'ok',
            msg: 'success',
            stats: { total, completed, ongoing, todo }
        })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Update Task (Status or Details)
router.post('/update', verifyToken, async (req, res) => {
    const { id, status, assignee_id, description, deadline, start_date, name, type } = req.body

    if (!id) return res.status(400).send({ status: 'error', msg: 'Task ID is required.' })

    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        const task = await Task.findById(id)
        if (!task) return res.status(404).send({ status: 'error', msg: 'Task not found.' })

        if (status) task.status = status
        if (name) task.name = name
        if (type) task.type = type
        if (description !== undefined) task.description = description
        if (deadline) task.deadline = new Date(deadline)
        if (start_date) task.start_date = new Date(start_date)

        if (assignee_id) {
            const staff = await Staff.findById(assignee_id)
            if (staff) task.assignee = staff._id
        }

        await task.save()
        return res.status(200).send({ status: 'ok', msg: 'success', task })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// View Single Task
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Task ID is required.' })

    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        const task = await Task.findById(id).populate('assignee', 'fullname profile_img_url')
        if (!task) return res.status(404).send({ status: 'error', msg: 'Task not found.' })

        return res.status(200).send({ status: 'ok', msg: 'success', task })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Delete Task
router.post('/delete', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Task ID is required.' })

    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        await Task.findByIdAndDelete(id)
        return res.status(200).send({ status: 'ok', msg: 'success' })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Export Tasks
router.post('/export', verifyToken, async (req, res) => {
    if (!checkRole(req.user))
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })

    try {
        const tasks = await Task.find().populate('assignee', 'fullname').sort({ timestamp: -1 }).lean()
        const fields = ['Task ID', 'Task Name', 'Type', 'Assignee', 'Status', 'Date Added', 'Start Date']
        let csv = fields.join(',') + '\n'

        tasks.forEach(t => {
            const row = [
                t.task_id,
                `"${t.name}"`,
                t.type,
                `"${t.assignee ? t.assignee.fullname : 'Unassigned'}"`,
                t.status,
                t.date_added ? new Date(t.date_added).toISOString().split('T')[0] : '',
                t.start_date ? new Date(t.start_date).toISOString().split('T')[0] : ''
            ]
            csv += row.join(',') + '\n'
        })

        res.header('Content-Type', 'text/csv')
        res.attachment('tasks.csv')
        return res.send(csv)

    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router