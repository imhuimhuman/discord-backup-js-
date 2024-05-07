const { enabled } = require('colors');
const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    data: {
        type: String,
        required: true
    },
    guildId: Number,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 2592000 
    },
    state: {
        type: String
    },
    scheduleTime: {
        type: String
    }, 
    enabled: {
        type: Boolean,
        default: false
    }




});

module.exports = mongoose.model('Backup', backupSchema);
