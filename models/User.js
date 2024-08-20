const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: String,
  username: String,
  avatar: String,
  discriminator: String,
  vps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VPS' }]
});

module.exports = mongoose.model('User', userSchema);
