const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// pg (Supabase) and @google-cloud/storage removed — not needed for current deployment
const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Setup Winston Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        // Write all logs with level `info` and below to `app_activity.log`
        new winston.transports.File({ filename: path.join(__dirname, 'logs', 'app_activity.log') }),
        new winston.transports.Console() // Also print to console
    ],
});

// ---------------------------------------------------------
// Security: CORS Whitelist
// ---------------------------------------------------------
const ALLOWED_ORIGINS = [
    'https://shanepanichdee.github.io',
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5500', // VS Code Live Server
    'http://localhost:5500',
    'null' // Local file execution
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        logger.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
        return callback(new Error('CORS policy: origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Quick response for preflight OPTIONS to avoid them hitting custom middleware
app.options('*', cors());

// ---------------------------------------------------------
// Security: Manual Security Headers (helmet equivalent)
// ---------------------------------------------------------
app.use((req, res, next) => {
    // skip security headers for OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
    );
    res.removeHeader('X-Powered-By');
    next();
});

// ---------------------------------------------------------
// Security: In-Memory Rate Limiter (no external package needed)
// ---------------------------------------------------------
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10; // max 10 attempts per window

function rateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.path}`;

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, windowStart: now });
        return next();
    }

    const record = rateLimitStore.get(key);

    // Reset window if expired
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.set(key, { count: 1, windowStart: now });
        return next();
    }

    record.count += 1;
    if (record.count > RATE_LIMIT_MAX) {
        const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStart)) / 1000);
        logger.warn(`[RATE_LIMIT] Blocked ${ip} on ${req.path} (${record.count} attempts)`);
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
            success: false,
            message: `พยายาม login มากเกินไป กรุณารอ ${Math.ceil(retryAfterSec / 60)} นาที`
        });
    }

    next();
}

// Clean up expired entries every 30 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(key);
        }
    }
}, 30 * 60 * 1000);

app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for large metadata

// ---------------------------------------------------------
// Health Check Endpoint (For Render Deployment)
// ---------------------------------------------------------
app.get('/', (req, res) => {
    res.status(200).send('DGForm API Server is running successfully.');
});

// ---------------------------------------------------------
// MongoDB Setup
// ---------------------------------------------------------
const metadataSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Metadata = mongoose.model('Metadata', metadataSchema);

// Schema for DG Masterclass Authentication
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// Schema for DG Masterclass App Logging
const appLogSchema = new mongoose.Schema({
    email: { type: String, required: true },
    action: { type: String, required: true }, // e.g., 'View_Chapter_1', 'Login'
    timestamp: { type: Date, default: Date.now }
});
const AppLog = mongoose.model('AppLog', appLogSchema);

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.log('⚠️ MONGO_URI not found in .env. MongoDB features will be disabled.');
            return;
        }
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
    }
};
connectDB();

// PostgreSQL (Supabase) and GCS removed — MongoDB is the sole database backend

// ---------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------

// --- Authentication (Login/Register) ---
app.post('/api/register', rateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'กรุณากรอก Email และ Password' });

        const isMongoConnected = mongoose.connection.readyState === 1;
        if (!isMongoConnected) return res.status(503).json({ success: false, message: 'ระบบฐานข้อมูลยังไม่พร้อมใช้งาน' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: 'Email นี้ถูกใช้งานแล้ว' });

        // Hash Password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();

        logger.info(`[AUTH] Register successful for user: ${email}`);
        res.status(201).json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
    } catch (error) {
        logger.error(`[AUTH_ERROR] Register failed: ${error.message}`);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดทางการประมวลผลเซิร์ฟเวอร์' });
    }
});

app.post('/api/login', rateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'กรุณากรอก Email และ Password' });

        const isMongoConnected = mongoose.connection.readyState === 1;
        if (!isMongoConnected) return res.status(503).json({ success: false, message: 'ระบบฐานข้อมูลยังไม่พร้อมใช้งาน' });

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            logger.warn(`[AUTH] Failed login (user not found): ${email}`);
            return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Compare password and hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`[AUTH] Failed login (password mismatch): ${email}`);
            return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Add to App Log
        await AppLog.create({ email, action: 'Login' });
        logger.info(`[AUTH] Login successful for user: ${email}`);

        res.status(200).json({ success: true, message: 'Login successful', email: user.email });
    } catch (error) {
        logger.error(`[AUTH_ERROR] Login failed: ${error.message}`);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดทางการประมวลผลเซิร์ฟเวอร์' });
    }
});

// --- Activity Logging ---
app.post('/api/log', async (req, res) => {
    try {
        const { email, action } = req.body;
        if (!email || !action) return res.status(400).json({ success: false, message: 'Missing email or action' });

        const isMongoConnected = mongoose.connection.readyState === 1;
        let createdLog = null;
        if (isMongoConnected) {
            createdLog = await AppLog.create({ email, action });
            logger.info(`[APP_LOG] User: ${email} | Action: ${action}`);
        } else {
            logger.warn(`[APP_LOG_LOCAL] User: ${email} | Action: ${action} (MongoDB offline)`);
        }
        res.status(200).json({
            success: true,
            mongoConnected: isMongoConnected,
            logId: createdLog?._id ?? null
        });
    } catch (error) {
        logger.error(`[APP_LOG_ERROR] Logging failed: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to record log' });
    }
});

// 1. Save to MongoDB (with upsert - works for both form submit and migration)
app.post('/api/save/mongodb', async (req, res) => {
    const data = req.body;
    const isMongoConnected = mongoose.connection.readyState === 1;

    try {
        // Log metadata only (avoid logging full payload to prevent crashes on large dictionary/glossary data)
        const actionText = data.action === 'update' ? '[LOCAL_UPDATE_LOG]' : '[LOCAL_SAVE_LOG]';
        logger.info(`${actionText} Domain: ${data.domain || 'Unknown'} | Title: ${data.title || 'Untitled'} | datasetId: ${data.datasetId || 'none'}`);

        if (!isMongoConnected) {
            return res.status(200).json({ message: 'Saved to Local Log successfully (MongoDB offline)', id: `local-${Date.now()}` });
        }

        // Build the query filter — prefer datasetId, fallback to title+agency
        const filter = data.datasetId
            ? { datasetId: data.datasetId }
            : { title: data.title, submitterAgency: data.submitterAgency };

        // Strip Mongoose internal fields from payload to avoid conflicts
        const { _id, __v, ...payload } = data;

        // Atomic upsert: update if found, insert if not — works for both migration and form submit
        const result = await Metadata.findOneAndUpdate(
            filter,
            { $set: payload },
            {
                upsert: true,       // create if not found
                new: true,          // return updated document
                strict: false,      // allow dynamic fields (dictionary, glossary, etc.)
                runValidators: false
            }
        );

        logger.info(`[MONGODB_UPSERT] document ID: ${result._id} | Domain: ${data.domain} | Title: ${data.title}`);

        res.status(200).json({ message: 'Saved to MongoDB successfully', id: result._id });
    } catch (error) {
        logger.error(`[SAVE_ERROR] Failed to save/update: ${error.message}`);
        res.status(500).json({ error: 'Failed to process data in MongoDB', detail: error.message });
    }
});

// --- Edit Password Verification (Server-side) ---
app.post('/api/verify-edit', rateLimiter, (req, res) => {
    const { password } = req.body;
    const editPassword = process.env.EDIT_PASSWORD;

    if (!editPassword) {
        logger.error('[VERIFY_EDIT] EDIT_PASSWORD not set in environment');
        return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    if (!password) {
        return res.status(400).json({ success: false, message: 'Password required' });
    }
    if (password !== editPassword) {
        logger.warn(`[VERIFY_EDIT] Failed attempt from IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
        return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    logger.info('[VERIFY_EDIT] Edit access granted');
    return res.status(200).json({ success: true });
});




// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
