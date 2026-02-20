const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        console.log(`[AUTH] Login successful for user: ${username}`);
        res.status(200).json({ success: true, message: 'Login successful' });
    } else {
        console.warn(`[AUTH] Failed login attempt for user: ${username}`);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Metadata Repository Backend is Running! 🚀');
});

// 1. Save to MongoDB
app.post('/api/save/mongodb', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'MongoDB service not available' });
    }
    try {
        const data = req.body;
        // Optionally generate a custom ID or use MongoDB's _id
        const newRecord = new Metadata(data);
        await newRecord.save();

        console.log(`Saved document to MongoDB: ${newRecord._id}`);
        res.status(200).json({ message: 'Saved to MongoDB successfully', id: newRecord._id });
    } catch (error) {
        console.error('MongoDB Save Error:', error);
        res.status(500).json({ error: 'Failed to save to MongoDB' });
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

        await file.save(JSON.stringify(data, null, 2), {
            contentType: 'application/json',
            metadata: {
                cacheControl: 'no-cache',
            },
        });

        console.log(`Uploaded file to GCS: ${filename}`);
        res.status(200).json({ message: 'Saved to GCS Data Lake successfully', path: filename });
    } catch (error) {
        console.error('GCS Upload Error:', error);
        res.status(500).json({ error: 'Failed to save to GCS' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
