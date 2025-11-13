const mongoose = require('mongoose')
const Schema = mongoose.Schema

const guestSchema = new Schema({
    fullname : String, 
    email: String, 
    phone_no: String,
    password: String,
    gender: String,
    date_of_birth: String,
    bookings: {type: mongoose.Schema.Types.ObjectId, ref: 'Booking'},
    favoriteServices: {type: mongoose.Schema.Types.ObjectId, ref: 'Service'},
    profile_img_id: { type: String, default: '' },
    profile_img_url: { type: String, default: '' },
    address: String,
    timestamp: Number,
    is_online:{type: Boolean, default: false },
    is_deleted: {type: Boolean, default: false},
    last_login: Number,
    last_logout: Number, 
    status: {type: String, enum: ["Active", "Suspended", "Deactivated"], default: "Active"},//Status can be 'Active', 'Suspended' or 'Deleted'
    createdAt: {type: Date, default: Date.now},
    updatedAt: {type: Date, default: Date.now},
    //is_verified: { type: Boolean, default: false },
    is_blocked: { type: Boolean, default: false },
    block_reason: {type: String, default: ''},
    is_banned: { type: Boolean, default: false },
    ban_reason: {type: String, default: ''},
    deletionReason: {
        type: String,
        default: null}, //Reason provided by the staff when the account is deleted
}, {collection: 'guests'})

const model = mongoose.model('Guest', guestSchema)
module.exports = model