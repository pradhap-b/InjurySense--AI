const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  signalEnergy: Number,
  rms: Number,
  speechActivity: Boolean,
  silenceDuration: Number,
  duration: Number
}, { timestamps: true })

module.exports = mongoose.model('VoiceActivity', schema)
