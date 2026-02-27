const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Storage } = require('@google-cloud/storage');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for large metadata

// ---------------------------------------------------------
// MongoDB Setup
// ---------------------------------------------------------
// Simple Schema for generic metadata storage
const metadataSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Metadata = mongoose.model('Metadata', metadataSchema);

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

// ---------------------------------------------------------
// Google Cloud Storage Setup
// ---------------------------------------------------------
let storage;
let bucket;

if (process.env.GCS_KEY_FILE_PATH && process.env.GCS_BUCKET_NAME) {
    storage = new Storage({ keyFilename: process.env.GCS_KEY_FILE_PATH });
    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    console.log(`✅ GCS Client initialized for bucket: ${process.env.GCS_BUCKET_NAME}`);
} else {
    console.log('⚠️ GCS credentials not found. GCS features will be disabled.');
}

// ---------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------

// --- Authentication (Login) ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Default credentials if not set in .env
    const validUser = process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || 'password@123';

    if (username === validUser && password === validPass) {
        logger.info(`[AUTH] Login successful for user: ${username}`);
        res.status(200).json({ success: true, message: 'Login successful' });
    } else {
        logger.warn(`[AUTH] Failed login attempt for user: ${username}`);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Metadata Repository Backend is Running! 🚀');
});

// 1. Save to MongoDB (with local file fallback and always logging)
app.post('/api/save/mongodb', async (req, res) => {
    const data = req.body;
    const isMongoConnected = mongoose.connection.readyState === 1;

    try {
        // ALWAYS log locally
        logger.info(`[LOCAL_SAVE_LOG] Domain: ${data.domain || 'Unknown'} | Title: ${data.title || 'Untitled'} | Data: ${JSON.stringify(data)}`);

        if (!isMongoConnected) {
            // If Mongo is offline, return success early as we already logged locally
            return res.status(200).json({ message: 'Saved to Local Log successfully (MongoDB offline)', id: `local-${Date.now()}` });
        }

        // Generate a custom ID or use MongoDB's _id
        const newRecord = new Metadata(data);
        await newRecord.save();

        logger.info(`[MONGODB] Saved document ID: ${newRecord._id} | Domain: ${data.domain} | Title: ${data.title}`);
        res.status(200).json({ message: 'Saved to Local Log and MongoDB successfully', id: newRecord._id });
    } catch (error) {
        logger.error(`[SAVE_ERROR] Failed to save: ${error.message}`);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// 2. Save to Google Cloud Storage (Data Lake)
app.post('/api/save/gcs', async (req, res) => {
    if (!bucket) {
        return res.status(503).json({ error: 'GCS service not available' });
    }
    try {
        const data = req.body;
        const domain = data.domain || 'unknown_domain';
        const title = data.title || 'untitled';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Define File Path in Bucket: raw/domain/title_timestamp.json
        const filename = `raw/${domain}/${title}_${timestamp}.json`;
        const file = bucket.file(filename);

        // Calculate size for logging
        const dataString = JSON.stringify(data, null, 2);
        const sizeBytes = Buffer.byteLength(dataString, 'utf8');

        await file.save(dataString, {
            contentType: 'application/json',
            metadata: {
                cacheControl: 'no-cache',
            },
        });

        logger.info(`[GCS] Uploaded file: ${filename} | Size: ${sizeBytes} bytes | Action: ${data.action || 'Unknown'}`);
        res.status(200).json({ message: 'Saved to GCS Data Lake successfully', path: filename });
    } catch (error) {
        logger.error(`[GCS] Upload Error: ${error.message}`);
        res.status(500).json({ error: 'Failed to save to GCS' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
