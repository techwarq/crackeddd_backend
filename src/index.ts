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
import { lucia } from './lib/auth.js'
import { verifyRequestOrigin } from 'lucia'
import type { Context } from './lib/context.js'

const app = new Hono<Context>()
const prisma = new PrismaClient()

// Log all incoming headers
app.use("*", async (c, next) => {
    console.log("Received headers:", c.req.header());
    return next();
});

// Modified origin checking middleware
app.use("*", async (c, next) => {
    if (c.req.method === "GET") {
        return next();
    }
    const originHeader = c.req.header("Origin") ?? null;
    const hostHeader = c.req.header("Host") ?? null;
    
    console.log("Origin:", originHeader);
    console.log("Host:", hostHeader);
    
    // For local testing, allow all origins
    return next();
    
    // Original code (commented out for now):
    // if (!originHeader || !hostHeader || !verifyRequestOrigin(originHeader, [hostHeader])) {
    //     return c.body(null, 403);
    // }
    // return next();
});

app.use("*", async (c, next) => {
    const sessionId = lucia.readSessionCookie(c.req.header("Cookie") ?? "");
    if (!sessionId) {
        c.set("user", null);
        c.set("session", null);
        return next();
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (session && session.fresh) {
        c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), { append: true });
    }
    if (!session) {
        c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), { append: true });
    }
    c.set("session", session);
    c.set("user", user);
    return next();
});

// Updated CORS configuration
app.use('*', cors({
    origin: ['http://localhost:3008', 'http://localhost:3000'], // Add any other allowed origins
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
}));

app.use('*', logger())
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

// Route definitions
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
});