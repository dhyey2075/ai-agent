import mongoose from 'mongoose';
import connectDB from '../lib/db.js';

await connectDB();

const fingerprintSchema = new mongoose.Schema({
    fingerprint: {
        type: String, 
        required: true,
        unique: true
    },
    messages: {
        type: Number,
        default: 3,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

// Check if the model already exists to prevent model recreation during hot reloads
export const Fingerprint = mongoose.models.Fingerprint || mongoose.model('Fingerprint', fingerprintSchema);
