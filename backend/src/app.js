import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import slotsRouter    from './routes/slots.js'
import bookingsRouter from './routes/bookings.js'
import pushRouter     from './routes/push.js'
import { startReminderJob } from './services/reminderService.js'

const app  = express()
const PORT = process.env.PORT ?? 4000

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/slots',    slotsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/push',     pushRouter)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 서버 실행: http://localhost:${PORT}`)
  startReminderJob()
})

export default app
