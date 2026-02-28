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
        const actionText = data.action === 'update' ? '[LOCAL_UPDATE_LOG]' : '[LOCAL_SAVE_LOG]';
        logger.info(`${actionText} Domain: ${data.domain || 'Unknown'} | Title: ${data.title || 'Untitled'} | Data: ${JSON.stringify(data)}`);

        if (!isMongoConnected) {
            // If Mongo is offline, return success early as we already logged locally
            return res.status(200).json({ message: 'Saved to Local Log successfully (MongoDB offline)', id: `local-${Date.now()}` });
        }

        if (data.action === 'update') {
            // Attempt to find existing record
            let existingRecord = null;
            if (data.datasetId) {
                existingRecord = await Metadata.findOne({ datasetId: data.datasetId });
            }

            // If we don't have it by datasetId yet (because GAS generated it later), fallback to Title + Agency
            if (!existingRecord) {
                existingRecord = await Metadata.findOne({ title: data.title, submitterAgency: data.submitterAgency });
            }

            if (existingRecord) {
                // Update the existing record with new data (including capturing the datasetId for the future)
                Object.assign(existingRecord, data);
                await existingRecord.save();

                logger.info(`[MONGODB_UPDATE] Updated document ID: ${existingRecord._id} | Domain: ${data.domain} | Title: ${data.title}`);
                return res.status(200).json({ message: 'Updated Local Log and MongoDB successfully', id: existingRecord._id });
            }
            // If not found at all, it will fall through to insertion below
        }

        // Generate a custom ID or use MongoDB's _id for new inserts (or if update record wasn't found)
        const newRecord = new Metadata(data);
        await newRecord.save();

        logger.info(`[MONGODB_INSERT] Saved new document ID: ${newRecord._id} | Domain: ${data.domain} | Title: ${data.title}`);
        res.status(200).json({ message: 'Saved to Local Log and MongoDB successfully', id: newRecord._id });
    } catch (error) {
        logger.error(`[SAVE_ERROR] Failed to save/update: ${error.message}`);
        res.status(500).json({ error: 'Failed to process data in MongoDB' });
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

const fs = require('fs');

// --- Scheduled Task: Backup Local Logs to GCS Data Lake ---
// This function runs periodically to upload the app_activity.log file
// to GCS, then clears the local file to prevent disk exhaustion on Render.

const LOG_FILE_PATH = path.join(__dirname, 'logs', 'app_activity.log');

async function backupLogsToGCS() {
    if (!bucket) {
        logger.warn('[LOG_BACKUP] GCS bucket not configured. Skipping log backup.');
        return;
    }

    try {
        // 1. Check if the log file exists and has content
        if (!fs.existsSync(LOG_FILE_PATH)) {
            return; // No file yet
        }

        const stats = await fs.promises.stat(LOG_FILE_PATH);
        if (stats.size === 0) {
            return; // File is empty, nothing to upload
        }

        // 2. Define filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const gcsFilename = `operation_logs/${timestamp}_app_activity.log`;
        const file = bucket.file(gcsFilename);

        // 3. Prevent writing to log *during* read by copying to temp first (optional, but safer)
        // For simplicity and lightweight nature, we'll stream it directly, but we use 
        // Winston which might be writing at the same time. The risk is extremely low for MVP.

        logger.info(`[LOG_BACKUP] Starting backup of ${stats.size} bytes to ${gcsFilename}...`);

        // 4. Upload to GCS
        await bucket.upload(LOG_FILE_PATH, {
            destination: gcsFilename,
            contentType: 'text/plain',
            metadata: {
                cacheControl: 'no-cache',
            }
        });

        logger.info(`[LOG_BACKUP] Successfully uploaded logs to GCS: ${gcsFilename}`);

        // 5. Truncate (clear) the local log file
        // We use truncate instead of deleting to keep the file handle valid for Winston
        await fs.promises.truncate(LOG_FILE_PATH, 0);
        logger.info(`[LOG_BACKUP] Cleared local log file.`);

    } catch (error) {
        // Need to use console.error here to avoid infinite loop of logging errors into the broken log file
        console.error(`[LOG_BACKUP_ERROR] Failed to backup logs: ${error.message}`);
    }
}

// Set up the interval for log backups
// For production, maybe every 12 hours (12 * 60 * 60 * 1000)
// For testing/demonstration right now, let's set it to run every 1 minute if called directly,
// but for normal server operation we will use 1 hour (60 * 60 * 1000)
const LOG_BACKUP_INTERVAL_MS = process.env.LOG_BACKUP_INTERVAL_MS || 60 * 60 * 1000; // Default 1 hour
setInterval(backupLogsToGCS, LOG_BACKUP_INTERVAL_MS);

// Quick test route to manually trigger the backup for debugging
app.get('/api/trigger-log-backup', async (req, res) => {
    logger.info('[MANUAL_TRIGGER] Log backup requested via API.');
    await backupLogsToGCS();
    res.send('Backup process completed. Check server logs.');
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
