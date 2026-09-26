const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	activity: { type: String, required: true, trim: true, maxlength: 80 },
	exercise: { type: String, trim: true, maxlength: 80 },
	startTime: Date,
	endTime: Date,
	duration: { type: Number, min: 0, max: 86400 },
	poseMetrics: { type: mongoose.Schema.Types.Mixed },
	motionMetrics: { type: mongoose.Schema.Types.Mixed },
	riskMetrics: { type: mongoose.Schema.Types.Mixed },
	repetitions: { type: Number, min: 0, max: 100000 },
	symmetry: { type: Number, min: 0, max: 100 },
	stability: { type: Number, min: 0, max: 100 }
}, { timestamps: true, minimize: true })

module.exports = mongoose.model('Session', sessionSchema)
