const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user')
const auth = require('../middleware/auth')

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must contain at least 6 characters' })
    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' })
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) })
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    res.status(201).json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role }, token })
  } catch (e) { res.status(500).json({ success: false, message: 'Registration failed' }) }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const user = await User.findOne({ email: String(email || '').toLowerCase() })
    if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ success: false, message: 'Invalid email or password' })
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role }, token })
  } catch { res.status(500).json({ success: false, message: 'Login failed' }) }
})

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id name email role createdAt').lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } })
  } catch { res.status(500).json({ success: false, message: 'Unable to load account' }) }
})

module.exports = router
