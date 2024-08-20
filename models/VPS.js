const mongoose = require('mongoose');

const vpsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   
});

const VPS = mongoose.model('VPS', vpsSchema);
module.exports = VPS;
