const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 4000 }
}, { _id: false })

const coachConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  conversationId: { type: String, required: true, index: true },
  messages: { type: [messageSchema], default: [] },
  context: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true })

module.exports = mongoose.model('CoachConversation', coachConversationSchema)
