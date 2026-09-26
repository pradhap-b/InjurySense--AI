const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

module.exports = mongoose.model('InjuryScreening', schema)
