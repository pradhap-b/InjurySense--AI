const mongoose = require('mongoose')

const workoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  activity: { type: String, required: true, trim: true },
  startedAt: Date,
  endedAt: Date,
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

module.exports = mongoose.model('Workout', workoutSchema)
