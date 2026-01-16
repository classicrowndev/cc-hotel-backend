const mongoose = require('mongoose')

const staffSchema = new mongoose.Schema({
    role: String,
    fullname: String,
    email: String,
    phone_no: String,
    password: String,
    profile_img_id: { type: String, default: '' },
    profile_img_url: { type: String, default: '' },
    role: { type: String, enum: ['Owner', 'Admin', 'Staff'], default: 'Staff' },
    primary_role: { type: String, default: '' }, // e.g., Reception, Laundry, Chef
    salary: { type: Number, default: 0 },
    task: { type: [String], enum: ['booking', 'room', 'dish', 'hall', 'order', 'event', 'none'], default: 'none' }, // Staff task assignment
    gender: String,
    date_of_birth: String,
    address: String,
    is_online: { type: Boolean, default: true },
    last_logout: { type: Number, default: null },
    last_login: { type: Number, default: null },
    is_blocked: { type: Boolean, default: false }, // set when staff is blocked
    block_reason: { type: String, default: '' },
    is_banned: { type: Boolean, default: false },
    ban_reason: { type: String, default: '' },    // reasons why this staff was banned
    is_deleted: { type: Boolean, default: false }, // set when staff account is deleted
    delete_reason: {
        type: String,
        default: null
    }, //Reason provided why this staff account was deleted
    timestamp: Number,
}, { collection: 'staffs' })

const model = mongoose.model('Staff', staffSchema)
module.exports = model