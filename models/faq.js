const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: {type: String, required: true},
    answer: {type: String, required: true},
    timestamp: Number
}, {collection: 'frequently_asked_questions'});

const model = mongoose.model('FAQ', faqSchema);
module.exports = model;