const mongoose = require('mongoose')

const analysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  source: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true, discriminatorKey: 'kind' })

module.exports = mongoose.model('Analysis', analysisSchema)
