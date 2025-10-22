const mongoose = require('mongoose')

const staffSchema = new mongoose.Schema({
    role: String,
    fullname: String,
    email: String,
    phone_no: String,
    password: String,
    profile_img_url: String,
    profile_img_id: String,
    role: {
        type: String,
        enum: ["Manager", "Receptionist", "Chef", "Waiter", "Cleaner", "Admin"],
        default: "Staff"
    },
    address: String,
    is_online: {type: Boolean, default: true},
    last_logout: {type: Number, default: null},
    last_login: {type: Number, default: null},
    is_blocked: {type: Boolean, default: false}, // set when staff is blocked
    block_reason: { type: String, default: '' },
    is_banned: { type: Boolean, default: false },
    ban_reason: {type: String, default: ''},    // reasons why this staff was banned
    is_deleted: {type: Boolean, default: false}, // set when staff account is deleted
    delete_reason: {
        type: String,
        default: null}, //Reason provided why this staff account was deleted
    timestamp: Number,
}, { collection: 'staffs' })

const model = mongoose.model('Staff', staffSchema)
module.exports = model