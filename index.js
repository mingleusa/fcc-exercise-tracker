const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exercise-tracker')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
})

const User = mongoose.model('User', userSchema)

const exerciseSchema = new mongoose.Schema({
  username: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
})

const Exercise = mongoose.model('Exercise', exerciseSchema)

function parseDateInput(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/api/users', async (req, res) => {
  try {
    const user = new User({ username: req.body.username })
    await user.save()
    res.json({ username: user.username, _id: user._id.toString() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/users', async (req, res) => {
  const users = await User.find({}, { username: 1 }).sort({ username: 1 })
  res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })))
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  const user = await User.findById(req.params._id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const { description, duration, date } = req.body
  const exerciseDate = date && date !== '' ? parseDateInput(date) : new Date()

  const exercise = new Exercise({
    username: user.username,
    userId: user._id,
    description,
    duration: parseInt(duration, 10),
    date: exerciseDate
  })

  await exercise.save()

  res.json({
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date.toDateString(),
    _id: user._id.toString()
  })
})

app.get('/api/users/:_id/logs', async (req, res) => {
  const user = await User.findById(req.params._id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const { from, to, limit } = req.query
  const filter = { userId: user._id }

  if (from || to) {
    filter.date = {}
    if (from) filter.date.$gte = parseDateInput(from)
    if (to) {
      const toDate = parseDateInput(to)
      toDate.setHours(23, 59, 59, 999)
      filter.date.$lte = toDate
    }
  }

  let query = Exercise.find(filter).sort({ date: 1 })
  if (limit) query = query.limit(parseInt(limit))

  const exercises = await query.exec()

  const log = exercises.map(ex => ({
    description: ex.description,
    duration: ex.duration,
    date: ex.date.toDateString()
  }))

  res.json({
    username: user.username,
    count: log.length,
    _id: user._id.toString(),
    log
  })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
