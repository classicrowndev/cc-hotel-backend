const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
    task_id: { type: String, required: true }, // e.g., #3021
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ['Room', 'Laundry', 'Restaurant', 'Service', 'Other'],
        required: true
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    status: {
        type: String,
        enum: ['To-do', 'On-going', 'Completed'],
        default: 'To-do'
    },
    description: { type: String }, // New field
    deadline: { type: Date },      // New field
    date_added: { type: Date, default: Date.now },
    start_date: { type: Date },
    timestamp: { type: Number, default: Date.now }
}, { collection: 'tasks' })

const model = mongoose.model('Task', taskSchema)
module.exports = model