const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const Staff = require('../../models/staff')
const verifyToken = require('../../middleware/verifyToken')
const cloudinary = require('../../utils/cloudinary')
const uploader = require('../../utils/multer')
const { sendStaffAccountMail } = require('../../utils/nodemailer')

/**
 * RBAC Helper
 * Owner can manage everyone (Admin, Staff).
 * Admin can ONLY manage Staff.
 */
const checkRBAC = (user, TargetStaffRole = null) => {
    if (user.role === 'Owner') return true
    if (user.role === 'Admin') {
        if (!TargetStaffRole || TargetStaffRole === 'Staff') return true
    }
    return false
}

// Get staff statistics
router.post("/stats", verifyToken, async (req, res) => {
    if (!['Owner', 'Admin'].includes(req.user.role)) {
        return res.status(403).send({ status: 'error', msg: 'Access denied.' })
    }

    try {
        const query = req.user.role === 'Owner' ? { role: { $in: ['Admin', 'Staff'] } } : { role: 'Staff' }
        query.is_deleted = false

        const total = await Staff.countDocuments(query)
        res.status(200).send({ status: "ok", msg: "success", stats: { total } })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Add new staff/admin
router.post("/add", verifyToken, uploader.any(), async (req, res) => {
    const { fullname, email, password, phone_no, role, primary_role, salary, gender, address, date_of_birth, task } = req.body

    if (!fullname || !email || !password || !phone_no || !role) {
        return res.status(400).send({ status: 'error', msg: 'Required fields: fullname, email, password, phone_no, role' })
    }

    if (!checkRBAC(req.user, role)) {
        return res.status(403).send({ status: 'error', msg: `Access denied. You cannot create an account with role: ${role}` })
    }

    try {
        const existing = await Staff.findOne({ email })
        if (existing) return res.status(400).send({ status: 'error', msg: 'Staff with this email already exists' })

        const hashedPassword = await bcrypt.hash(password, 10)
        const staffData = {
            fullname,
            email,
            phone_no,
            password: hashedPassword,
            role,
            primary_role: primary_role || '',
            salary: salary || 0,
            gender,
            address,
            date_of_birth,
            task: role === 'Staff' ? (task || 'none') : undefined,
            timestamp: Date.now()
        }

        // Handle profile image upload
        if (req.files && req.files.length > 0) {
            const file = req.files[0]
            const upload = await cloudinary.uploader.upload(file.path, { folder: "staff-images" })
            staffData.profile_img_id = upload.public_id
            staffData.profile_img_url = upload.secure_url
        }

        const staff = new Staff(staffData)
        await staff.save()

        // Send confirmation mail
        await sendStaffAccountMail(email, password, fullname, role, task)

        res.status(200).send({ status: 'ok', msg: 'Staff added successfully', staff })
    } catch (e) {
        console.error(e)
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Update staff/admin
router.post("/update", verifyToken, uploader.any(), async (req, res) => {
    const { id, fullname, email, phone_no, role, primary_role, salary, gender, address, date_of_birth, task, status } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })

    try {
        let staff = await Staff.findById(id)
        if (!staff) return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        if (!checkRBAC(req.user, staff.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied. You cannot manage this account.' })
        }

        // Update fields
        staff.fullname = fullname || staff.fullname
        staff.email = email || staff.email
        staff.phone_no = phone_no || staff.phone_no
        staff.primary_role = primary_role !== undefined ? primary_role : staff.primary_role
        staff.salary = salary || staff.salary
        staff.gender = gender || staff.gender
        staff.address = address || staff.address
        staff.date_of_birth = date_of_birth || staff.date_of_birth

        if (role && req.user.role === 'Owner') {
            staff.role = role
        }

        if (staff.role === 'Staff' && task) {
            staff.task = Array.isArray(task) ? task : [task]
        }

        if (status === "Blocked") staff.is_blocked = true
        if (status === "Active") staff.is_blocked = false

        // Handle profile image upload
        if (req.files && req.files.length > 0) {
            if (staff.profile_img_id) {
                await cloudinary.uploader.destroy(staff.profile_img_id).catch(e => console.error("Cloudinary delete error:", e))
            }
            const file = req.files[0]
            const upload = await cloudinary.uploader.upload(file.path, { folder: "staff-images" })
            staff.profile_img_id = upload.public_id
            staff.profile_img_url = upload.secure_url
        }

        staff.updatedAt = Date.now()
        await staff.save()
        res.status(200).send({ status: 'ok', msg: 'Staff updated successfully', staff })
    } catch (e) {
        console.error(e)
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// View all staff (filtered by RBAC with Pagination)
router.post("/all", verifyToken, async (req, res) => {
    const { page = 1, limit = 20 } = req.body
    try {
        const query = req.user.role === 'Owner' ? { role: { $in: ['Admin', 'Staff'] } } : { role: 'Staff' }
        query.is_deleted = false

        const count = await Staff.countDocuments(query)
        const staff = await Staff.find(query)
            .select("-password")
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            staff
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// View specific staff
router.post('/view', verifyToken, async (req, res) => {
    const { id } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })

    try {
        const staff = await Staff.findById(id).select("-password")
        if (!staff) return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        if (!checkRBAC(req.user, staff.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        return res.status(200).send({ status: 'ok', msg: 'success', staff })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Delete staff
router.post("/delete", verifyToken, async (req, res) => {
    const { id, reason } = req.body
    if (!id) return res.status(400).send({ status: 'error', msg: 'Staff ID is required' })

    try {
        const staff = await Staff.findById(id)
        if (!staff) return res.status(404).send({ status: 'error', msg: 'Staff not found' })

        if (!checkRBAC(req.user, staff.role)) {
            return res.status(403).send({ status: 'error', msg: 'Access denied.' })
        }

        staff.is_deleted = true
        staff.delete_reason = reason || null
        await staff.save()

        res.status(200).send({ status: 'ok', msg: 'Staff deleted successfully' })
    } catch (e) {
        res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})

// Search staff (with Pagination)
router.post("/search", verifyToken, async (req, res) => {
    const { query, page = 1, limit = 20 } = req.body
    if (!query) return res.status(400).send({ status: 'error', msg: 'Search query is required' })

    try {
        const searchRegex = { $regex: query, $options: "i" }
        const rbacQuery = req.user.role === 'Owner' ? { role: { $in: ['Admin', 'Staff'] } } : { role: 'Staff' }

        const baseQuery = {
            ...rbacQuery,
            $or: [
                { fullname: searchRegex },
                { email: searchRegex },
                { phone_no: searchRegex },
                { role: searchRegex },
                { primary_role: searchRegex }
            ],
            is_deleted: false
        }

        const count = await Staff.countDocuments(baseQuery)
        const staff = await Staff.find(baseQuery)
            .select("-password")
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()

        res.status(200).send({
            status: "ok",
            msg: "success",
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            staff
        })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
})

// Export staff to CSV
router.get("/export", verifyToken, async (req, res) => {
    try {
        const query = req.user.role === 'Owner' ? { role: { $in: ['Admin', 'Staff'] } } : { role: 'Staff' }
        query.is_deleted = false

        const staff = await Staff.find(query).lean()
        let csv = "Fullname,Role,Primary Role,Email,Phone,Salary,Joined\n"
        staff.forEach(s => {
            csv += `${s.fullname},${s.role},${s.primary_role || 'N/A'},${s.email},${s.phone_no},${s.salary || 0},${new Date(s.timestamp || s.createdAt).toLocaleDateString()}\n`
        })

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=staffs.csv')
        res.status(200).send(csv)
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Export failed", error: e.message })
    }
})

// ALIASES for backward compatibility
router.post('/create_staff', verifyToken, uploader.any(), async (req, res) => {
    req.url = '/add';
    router.handle(req, res);
});
router.post('/edit_staff', verifyToken, uploader.any(), async (req, res) => {
    req.url = '/update';
    router.handle(req, res);
});
router.post('/view_staffs', verifyToken, async (req, res) => {
    req.url = '/all';
    router.handle(req, res);
});
router.post('/view_staff', verifyToken, async (req, res) => {
    req.url = '/view';
    router.handle(req, res);
});
router.post('/delete_staff', verifyToken, async (req, res) => {
    req.url = '/delete';
    router.handle(req, res);
});
router.post('/block_staff', verifyToken, async (req, res) => {
    req.body.status = "Blocked";
    req.url = '/update';
    router.handle(req, res);
});
router.post('/unblock_staff', verifyToken, async (req, res) => {
    req.body.status = "Active";
    req.url = '/update';
    router.handle(req, res);
});
router.post('/blocked_staffs', verifyToken, async (req, res) => {
    try {
        const query = req.user.role === 'Owner' ? { role: { $in: ['Admin', 'Staff'] } } : { role: 'Staff' }
        query.is_deleted = false;
        query.is_blocked = true;
        const blockedStaffs = await Staff.find(query).select("-password").sort({ timestamp: -1 })
        res.status(200).send({ status: "ok", msg: "success", count: blockedStaffs.length, blockedStaffs })
    } catch (e) {
        res.status(500).send({ status: "error", msg: "Error occurred", error: e.message })
    }
});

module.exports = router