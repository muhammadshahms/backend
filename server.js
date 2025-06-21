import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://muhammadshah4589:wwQe23twXmSTJ8dj@cluster0-shard-00-00.glmz8.mongodb.net:27017,cluster0-shard-00-01.glmz8.mongodb.net:27017,cluster0-shard-00-02.glmz8.mongodb.net:27017/?ssl=true&replicaSet=atlas-m5oeec-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0', {});

const PrintLog = mongoose.model('PrintLog', new mongoose.Schema({
    StudentID: { type: String, unique: true }, // Enforces uniqueness in DB
    Name: String,
    Serial: String,
    Method: String,
    Timestamp: String,
}));


// Attendance Model
const Attendance = mongoose.model('Attendance', {
    StudentID: String,
    Name: String,
    Date: { type: String, default: new Date().toISOString().split('T')[0] },
    Timestamp: { type: Date, default: Date.now },
    Status: { type: String, enum: ['present', 'absent'], default: 'present' }
});

app.post('/save-log', async (req, res) => {
    const logs = req.body.logs;

    if (!Array.isArray(logs)) {
        return res.status(400).json({ message: 'Invalid format' });
    }

    const uniqueLogsMap = new Map();
    logs.forEach(log => {
        if (!uniqueLogsMap.has(log.StudentID)) {
            uniqueLogsMap.set(log.StudentID, log);
        }
    });

    const uniqueLogs = Array.from(uniqueLogsMap.values());

    try {
        for (const log of uniqueLogs) {
            await PrintLog.updateOne(
                { StudentID: log.StudentID },
                { $setOnInsert: log },
                { upsert: true }
            );
        }

        res.json({ message: 'Unique logs inserted (or skipped if duplicate)' });
    } catch (err) {
        res.status(500).json({ message: 'DB Error', error: err });
    }
});


// Get attendance logs
app.get('/attendance-logs', async (req, res) => {
    try {
        const logs = await Attendance.find().sort({ Timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'DB Error', error: err });
    }
});
app.get('/', (req, res) => {
    res.send('Hello World');
});
// Fetch logs
app.get('/logs', async (req, res) => {
    const logs = await PrintLog.find().sort({ Timestamp: -1 });
    res.json(logs);
});

const seen = new Set();
await PrintLog.aggregate([
    {
        $group: {
            _id: "$StudentID",
            ids: { $push: "$_id" },
            count: { $sum: 1 }
        }
    },
    {
        $match: {
            count: { $gt: 1 }
        }
    }
]).then(async duplicates => {
    for (const dup of duplicates) {
        // Keep the first and remove the rest
        const [keep, ...remove] = dup.ids;
        await PrintLog.deleteMany({ _id: { $in: remove } });
    }
});

app.listen(3001, () => console.log('✅ Server running on http://localhost:3001'));
