const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  bodyArea: { type: String, required: true, trim: true },
  painLevel: { type: Number, min: 0, max: 10, required: true },
  notes: { type: String, maxlength: 2000 }
}, { timestamps: true })

module.exports = mongoose.model('PainRecord', schema)
