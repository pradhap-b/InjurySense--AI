const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  blinkCount: Number,
  blinkRate: Number,
  leftEyeOpenness: Number,
  rightEyeOpenness: Number,
  gazeDirection: String,
  faceConfidence: Number,
  duration: Number
}, { timestamps: true })

module.exports = mongoose.model('EyeActivity', schema)
