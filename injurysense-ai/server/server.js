const path = require('path')
const crypto = require('crypto')
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const helmet = require('helmet')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const auth = require('./middleware/auth')
const Session = require('./models/session')
const Analysis = require('./models/analysis')
const InjuryScreening = require('./models/injuryScreening')
const VoiceActivity = require('./models/voiceActivity')
const EyeActivity = require('./models/eyeActivity')
const PainRecord = require('./models/painRecord')
const Workout = require('./models/workout')
const Alert = require('./models/alert')
const CoachConversation = require('./models/coachConversation')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173'
const apiError = (res, status, message) => res.status(status).json({ success: false, message })
const databaseConnected = () => mongoose.connection.readyState === 1

app.use(helmet())
app.use(cors({ origin: clientOrigin, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(rateLimit({ windowMs: 60 * 1000, max: 180, standardHeaders: true, legacyHeaders: false }))

app.get('/api/health', (_req, res) => {
  const connected = databaseConnected()
  res.status(connected ? 200 : 503).json({
    success: connected,
    server: 'online',
    database: connected ? 'connected' : 'disconnected',
    aiCoach: process.env.AI_API_KEY && process.env.AI_API_URL && process.env.AI_MODEL ? 'connected' : 'demo',
    timestamp: new Date().toISOString()
  })
})
app.get('/api/test', (_req, res) => res.json({ success: true, message: 'InjurySense API is working' }))
app.use('/api/auth', authRoutes)

function validateSession(body) {
  const payload = body || {}
  const numericFields = ['duration', 'repetitions', 'symmetry', 'stability']
  if (!String(payload.activity || '').trim()) return 'Activity is required'
  for (const field of numericFields) {
    if (payload[field] !== undefined && (!Number.isFinite(Number(payload[field])) || Number(payload[field]) < 0)) return `${field} must be a non-negative number`
  }
  if (payload.symmetry !== undefined && Number(payload.symmetry) > 100) return 'symmetry must be between 0 and 100'
  if (payload.stability !== undefined && Number(payload.stability) > 100) return 'stability must be between 0 and 100'
  return null
}

function optionalAuth(req, _res, next) {
  if (req.headers.authorization) return auth(req, _res, next)
  next()
}

function riskFromMetrics(metrics = {}) {
  const symmetry = Number(metrics.symmetry)
  const confidence = Number(metrics.confidence)
  if (!Number.isFinite(symmetry)) return { riskLevel: 'unknown', confidence: 0, bodyArea: metrics.bodyArea || 'Not specified', observation: 'Insufficient live measurements were provided.', action: 'Use live camera or motion analysis for a data-backed screening.' }
  const riskLevel = symmetry < 70 ? 'high' : symmetry < 82 ? 'moderate' : 'low'
  return { riskLevel, confidence: Number.isFinite(confidence) ? confidence / 100 : 0.5, bodyArea: 'Movement pattern', observation: `Left/right movement symmetry measured at ${symmetry}%.`, action: riskLevel === 'high' ? 'Pause activity and seek professional assessment if symptoms occur.' : 'Use controlled technique and stop if pain occurs.' }
}

async function saveAnalysis(req, source, metrics) {
  if (!databaseConnected()) return null
  const model = source === 'injury' ? InjuryScreening : source === 'voice' ? VoiceActivity : source === 'eye' ? EyeActivity : Analysis
  if (source === 'voice') return model.create({ userId: req.user?.id || null, signalEnergy: metrics.signalEnergy ?? metrics.energy, rms: metrics.rms, speechActivity: metrics.speechActivity, silenceDuration: metrics.silenceDuration, duration: metrics.duration })
  if (source === 'eye') return model.create({ userId: req.user?.id || null, blinkCount: metrics.blinkCount, blinkRate: metrics.blinkRate, leftEyeOpenness: metrics.leftEyeOpenness ?? metrics.leftOpen, rightEyeOpenness: metrics.rightEyeOpenness ?? metrics.rightOpen, gazeDirection: metrics.gazeDirection ?? metrics.gaze, faceConfidence: metrics.faceConfidence, duration: metrics.duration })
  return model.create({ userId: req.user?.id || null, metrics, ...metrics })
}

app.post('/api/injury/analyze', optionalAuth, async (req, res) => {
  const metrics = req.body?.metrics || req.body || {}
  const analysis = riskFromMetrics(metrics)
  if (req.body?.painLevel != null) analysis.observation = `User-reported pain level: ${req.body.painLevel}/10 in ${req.body.bodyArea || 'unspecified area'}.`
  try {
    await saveAnalysis(req, 'injury', { ...metrics, ...analysis, painLevel: req.body?.painLevel, bodyArea: req.body?.bodyArea })
    if (databaseConnected() && req.body?.painLevel != null) await PainRecord.create({ userId: req.user?.id || null, bodyArea: req.body?.bodyArea || 'unspecified', painLevel: Number(req.body.painLevel), notes: req.body?.notes })
    res.json({ success: true, analysis, data: { analysis } })
  } catch { apiError(res, 503, 'Analysis completed locally, but the database is unavailable.') }
})

for (const [route, source] of [['movement', 'motion'], ['voice', 'voice'], ['eye', 'eye']]) {
  app.post(`/api/${route}/analyze`, optionalAuth, async (req, res) => {
    try {
      await saveAnalysis(req, source, req.body || {})
      res.json({ success: true, data: { received: true, source: req.body?.source || 'browser', metrics: req.body || {} } })
    } catch { apiError(res, 503, 'Analysis completed locally, but the database is unavailable.') }
  })
}

app.post('/api/workout/start', optionalAuth, (_req, res) => res.json({ success: true, data: { sessionId: new mongoose.Types.ObjectId().toString(), startedAt: new Date().toISOString() } }))
app.post('/api/sessions', auth, async (req, res) => {
  const validationError = validateSession(req.body)
  if (validationError) return apiError(res, 400, validationError)
  if (!databaseConnected()) return apiError(res, 503, 'Database unavailable; session was not persisted.')
  try {
    const body = req.body
    const session = await Session.create({
      userId: req.user.id,
      activity: String(body.activity).trim(),
      exercise: body.exercise,
      startTime: body.startTime,
      endTime: body.endTime,
      duration: body.duration === undefined ? undefined : Number(body.duration),
      poseMetrics: body.poseMetrics,
      motionMetrics: body.motionMetrics,
      riskMetrics: body.riskMetrics || (body.riskLevel ? { riskLevel: body.riskLevel } : undefined),
      repetitions: body.repetitions === undefined ? undefined : Number(body.repetitions),
      symmetry: body.symmetry === undefined ? undefined : Number(body.symmetry),
      stability: body.stability === undefined ? undefined : Number(body.stability)
    })
    res.status(201).json({ success: true, session })
  } catch (error) {
    console.error(`Session save failed: ${error.message}`)
    apiError(res, 500, 'Unable to save session.')
  }
})
app.post('/api/workout/end', auth, async (req, res) => {
  if (!databaseConnected()) return apiError(res, 503, 'Database unavailable; session was not persisted.')
  try {
    const metrics = req.body?.metrics || {}
    const session = await Session.create({ userId: req.user.id, activity: req.body?.activity || 'Session', exercise: req.body?.exercise, duration: req.body?.duration, repetitions: metrics.repetitions, symmetry: metrics.symmetry, stability: metrics.stability, poseMetrics: metrics, riskMetrics: req.body?.riskMetrics })
    await Workout.create({ userId: req.user.id, sessionId: session._id, activity: session.activity, startedAt: req.body?.startedAt, endedAt: new Date(), metrics })
    res.json({ success: true, data: { sessionId: session._id } })
  } catch { apiError(res, 503, 'Database unavailable; session was not persisted.') }
})

app.post('/api/emergency/trigger', optionalAuth, async (req, res) => {
  try {
    if (databaseConnected()) await Alert.create({ userId: req.user?.id || null, type: 'emergency', message: 'Emergency confirmation recorded.', metadata: req.body || {} })
    res.json({ success: true, data: { confirmed: true, timestamp: new Date().toISOString(), message: 'Emergency confirmation recorded. No external emergency service was contacted.' } })
  } catch { apiError(res, 503, 'Emergency event could not be saved.') }
})

app.get('/api/reports/history', auth, async (req, res) => {
  if (!databaseConnected()) return apiError(res, 503, 'Database unavailable; reports cannot be loaded.')
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean()
    res.json({ success: true, sessions, data: { sessions } })
  } catch { apiError(res, 500, 'Unable to load report history.') }
})

app.post('/api/coach/chat', optionalAuth, async (req, res) => {
  const message = String(req.body?.message || '').trim()
  if (!message) return apiError(res, 400, 'Message is required')
  const conversationId = String(req.body?.conversationId || crypto.randomUUID())
  let reply
  let demo = true
  if (process.env.AI_API_KEY && process.env.AI_API_URL && process.env.AI_MODEL) {
    try {
      const response = await fetch(process.env.AI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` }, body: JSON.stringify({ model: process.env.AI_MODEL, messages: [{ role: 'system', content: 'You are a sports-safety assistant. Give cautious, non-diagnostic guidance and recommend professional care for serious symptoms.' }, { role: 'user', content: message }] }) })
      const data = await response.json()
      reply = data.choices?.[0]?.message?.content
      demo = false
    } catch (error) { console.error(`Coach provider error: ${error.message}`) }
  }
  if (!reply) { demo = true; reply = 'AI DEMO MODE: Use controlled, pain-free movement, warm up gradually, and stop if pain is severe or function is affected. InjurySense provides screening support rather than a medical diagnosis.' }
  try {
    if (databaseConnected()) {
      const conversation = await CoachConversation.findOneAndUpdate({ userId: req.user?.id || null, conversationId }, { $push: { messages: [{ role: 'user', content: message }, { role: 'assistant', content: reply }] }, $setOnInsert: { userId: req.user?.id || null, conversationId, context: req.body?.context || {} } }, { upsert: true, new: true, setDefaultsOnInsert: true })
      return res.json({ success: true, reply, demo, data: { reply, demo, conversationId: conversation.conversationId } })
    }
    res.json({ success: true, reply, demo, data: { reply, demo, conversationId } })
  } catch { apiError(res, 503, 'Coach response was generated, but the conversation could not be saved.') }
})

app.use(express.static(path.resolve(__dirname, '../client/dist')))
app.get('*', (req, res) => { if (req.path.startsWith('/api/')) return apiError(res, 404, 'Route not found'); res.sendFile(path.resolve(__dirname, '../client/dist/index.html')) })

const PORT = process.env.PORT || 5000
async function start() {
  const connected = await connectDB()
  app.listen(PORT, () => {
    console.log(`InjurySense AI server: http://localhost:${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
    console.log(`MongoDB: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`)
    console.log(`🤖 AI Coach: ${process.env.AI_API_KEY && process.env.AI_API_URL && process.env.AI_MODEL ? 'Ready' : 'DEMO MODE'}`)
  })
}

if (require.main === module) start()
module.exports = app
