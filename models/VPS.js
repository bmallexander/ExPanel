const mongoose = require('mongoose');

const vpsSchema = new mongoose.Schema({
  name: String,
  image: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  containerId: String,
});

module.exports = mongoose.model('VPS', vpsSchema);
