import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { PrismaClient } from '@prisma/client'
import router from './apis/server'
import { mainRouter } from './apis/index.js'
import { loginRouter } from './apis/login.js'
import { signupRouter } from './apis/signup.js'
import { logoutRouter } from './apis/logout.js'


const app = new Hono()
const prisma = new PrismaClient()

// Middlewares
app.use('*', logger())
app.use('*', cors())
app.use('*', prettyJSON())

// Custom error handling middleware
app.use('*', async (c, next) => {
  try {
    await next()
  } catch (err) {
    console.error('Error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

app.route('/api', router)
app.route('/', mainRouter)
app.route('/', loginRouter)
app.route('/', signupRouter)
app.route('/', logoutRouter)
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/db-test', async (c) => {
  try {
    await prisma.$connect()
    return c.json({ message: 'Database connected successfully!' })
  } catch (error) {
    console.error('Error connecting to the database:', error)
    return c.json({ error: 'Database connection failed' }, 500)
  } finally {
    await prisma.$disconnect()
  }
})

// Start server function
const startServer = async () => {
  const port = 3008
  console.log(`Server is running on port ${port}`)
  
  serve({
    fetch: app.fetch,
    port: Number(port)
  })
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server and database connection.')
  await prisma.$disconnect()
  process.exit(0)
})

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})