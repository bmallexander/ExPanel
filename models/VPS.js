const mongoose = require('mongoose');

const vpsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  containerId: { type: String },
  os: { type: String } 
});

module.exports = mongoose.model('VPS', vpsSchema);
