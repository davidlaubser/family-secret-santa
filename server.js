// server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const { readJson, writeJson } = require('./utils/db');
const { runDraw } = require('./utils/draw');
const { sendAssignmentEmails } = require('./utils/mailer');

const app = express();

const PORT = process.env.PORT || 1225;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const DRAW_FILE = path.join(__dirname, 'data', 'draw.json');
const EXCL_FILE = path.join(__dirname, 'data', 'exclusions.json');

// Middleware
app.use(express.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'change-me',
        resave: false,
        saveUninitialized: false
    })
);
app.use(express.static(path.join(__dirname, 'public')));

// Helpers

async function getUsersData() {
    return readJson(USERS_FILE, { users: [] });
}

async function saveUsersData(data) {
    return writeJson(USERS_FILE, data);
}

async function getDrawData() {
    return readJson(DRAW_FILE, {
        status: 'not-run',
        createdAt: null,
        assignments: []
    });
}

async function saveDrawData(data) {
    return writeJson(DRAW_FILE, data);
}

async function getExclusionsData() {
    return readJson(EXCL_FILE, { exclusions: [] });
}

async function saveExclusionsData(data) {
    return writeJson(EXCL_FILE, data);
}

async function getCurrentUser(req) {
    if (!req.session.userId) return null;
    const usersData = await getUsersData();
    return usersData.users.find(u => u.id === req.session.userId) || null;
}

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

async function requireAdmin(req, res, next) {
    const user = await getCurrentUser(req);
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin only' });
    }
    req.user = user;
    next();
}

// Routes

// Auth – register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, notes } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }

        const emailNorm = String(email).trim().toLowerCase();
        const usersData = await getUsersData();

        const existing = usersData.users.find(u => u.email === emailNorm);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const isAdmin = emailNorm === String(process.env.ADMIN_EMAIL).trim().toLowerCase();

        const newUser = {
            id: uuidv4(),
            name: name.trim(),
            email: emailNorm,
            passwordHash: hash,
            isAdmin,
            notes: notes || '',
            createdAt: new Date().toISOString()
        };

        usersData.users.push(newUser);
        await saveUsersData(usersData);

        req.session.userId = newUser.id;

        res.json({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            isAdmin: newUser.isAdmin
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Auth – login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const emailNorm = String(email || '').trim().toLowerCase();

        const usersData = await getUsersData();
        const user = usersData.users.find(u => u.email === emailNorm);

        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const match = await bcrypt.compare(password || '', user.passwordHash);
        if (!match) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        req.session.userId = user.id;

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Auth – logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

// Who am I
app.get('/api/me', async (req, res) => {
    try {
        const user = await getCurrentUser(req);
        if (!user) {
            return res.json({ loggedIn: false });
        }
        res.json({
            loggedIn: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                notes: user.notes || ''
            }
        });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Participant – update notes/preferences
app.post('/api/participant/profile', requireAuth, async (req, res) => {
    try {
        const { notes } = req.body;
        const usersData = await getUsersData();
        const user = usersData.users.find(u => u.id === req.session.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        user.notes = notes || '';
        await saveUsersData(usersData);

        res.json({ ok: true, notes: user.notes });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Participant – get own assignment (only reveals their person)
app.get('/api/participant/assignment', requireAuth, async (req, res) => {
    try {
        const drawData = await getDrawData();
        if (drawData.status !== 'completed') {
            return res.json({ hasAssignment: false });
        }

        const usersData = await getUsersData();
        const assignment = drawData.assignments.find(a => a.giverId === req.session.userId);

        if (!assignment) {
            return res.json({ hasAssignment: false });
        }

        const receiver = usersData.users.find(u => u.id === assignment.receiverId);
        if (!receiver) {
            return res.json({ hasAssignment: false });
        }

        res.json({
            hasAssignment: true,
            receiver: {
                name: receiver.name,
                notes: receiver.notes || ''
            }
        });
    } catch (err) {
        console.error('Assignment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – overview of participants
app.get('/api/admin/participants', requireAdmin, async (req, res) => {
    try {
        const usersData = await getUsersData();
        const participants = usersData.users.filter(u => !u.isAdmin).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            notes: u.notes || ''
        }));

        res.json({ participants });
    } catch (err) {
        console.error('Admin participants error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – get current draw status + assignments (full mapping)
app.get('/api/admin/assignments', requireAdmin, async (req, res) => {
    try {
        const drawData = await getDrawData();
        const usersData = await getUsersData();

        const userById = id => usersData.users.find(u => u.id === id);

        const detailedAssignments = drawData.assignments.map(a => {
            const giver = userById(a.giverId);
            const receiver = userById(a.receiverId);
            return {
                giverName: giver ? giver.name : 'Unknown',
                giverEmail: giver ? giver.email : '',
                receiverName: receiver ? receiver.name : 'Unknown',
                receiverEmail: receiver ? receiver.email : ''
            };
        });

        res.json({
            status: drawData.status,
            createdAt: drawData.createdAt,
            assignments: detailedAssignments
        });
    } catch (err) {
        console.error('Admin assignments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – get exclusions
app.get('/api/admin/exclusions', requireAdmin, async (req, res) => {
    try {
        const exclusionsData = await getExclusionsData();
        const usersData = await getUsersData();

        const userById = id => usersData.users.find(u => u.id === id);

        const detailed = exclusionsData.exclusions.map(ex => {
            const a = userById(ex.aId);
            const b = userById(ex.bId);
            return {
                id: ex.id,
                aId: ex.aId,
                bId: ex.bId,
                aName: a ? a.name : 'Unknown',
                bName: b ? b.name : 'Unknown'
            };
        });

        res.json({ exclusions: detailed });
    } catch (err) {
        console.error('Admin exclusions error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – add exclusion pair
app.post('/api/admin/exclusions', requireAdmin, async (req, res) => {
    try {
        const { aId, bId } = req.body;
        if (!aId || !bId || aId === bId) {
            return res.status(400).json({ error: 'Invalid exclusion.' });
        }

        const exclusionsData = await getExclusionsData();

        const exists = exclusionsData.exclusions.some(
            ex =>
                (ex.aId === aId && ex.bId === bId) ||
                (ex.aId === bId && ex.bId === aId)
        );
        if (exists) {
            return res.status(400).json({ error: 'Exclusion already exists.' });
        }

        exclusionsData.exclusions.push({
            id: uuidv4(),
            aId,
            bId
        });

        await saveExclusionsData(exclusionsData);

        res.json({ ok: true });
    } catch (err) {
        console.error('Exclusion add error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – delete exclusion
app.delete('/api/admin/exclusions/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const exclusionsData = await getExclusionsData();
        const before = exclusionsData.exclusions.length;
        exclusionsData.exclusions = exclusionsData.exclusions.filter(ex => ex.id !== id);

        if (exclusionsData.exclusions.length === before) {
            return res.status(404).json({ error: 'Exclusion not found.' });
        }

        await saveExclusionsData(exclusionsData);
        res.json({ ok: true });
    } catch (err) {
        console.error('Exclusion delete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin – run the draw and email everyone
app.post('/api/admin/run-draw', requireAdmin, async (req, res) => {
    try {
        const drawData = await getDrawData();
        if (drawData.status === 'completed') {
            return res.status(400).json({ error: 'Draw already completed.' });
        }

        const usersData = await getUsersData();
        const participants = usersData.users.filter(u => !u.isAdmin);

        if (participants.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 participants.' });
        }

        const exclusionsData = await getExclusionsData();
        const assignments = runDraw(participants, exclusionsData.exclusions);

        if (!assignments) {
            return res.status(400).json({
                error: 'Unable to find a valid draw. Try removing some exclusions or reordering participants.'
            });
        }

        const newDraw = {
            status: 'completed',
            createdAt: new Date().toISOString(),
            assignments
        };

        await saveDrawData(newDraw);

        const emailResult = await sendAssignmentEmails(assignments, participants);

        res.json({
            ok: true,
            message: 'Draw completed.',
            emailSent: emailResult.sent,
            emailReason: emailResult.reason || null
        });
    } catch (err) {
        console.error('Run draw error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fallback – serve index.html for any unknown path (simple SPA behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(PORT, () => {
    console.log(`Secret Santa server running on port ${PORT}`);
});
