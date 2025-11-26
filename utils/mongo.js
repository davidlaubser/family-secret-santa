// utils/mongo.js
const { MongoClient } = require('mongodb');

let client;
let db;

function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

function getUsersCollection() {
    return getDb().collection('users');
}

function getDrawCollection() {
    return getDb().collection('draw');
}

function getExclusionsCollection() {
    return getDb().collection('exclusions');
}

async function initDb() {
    if (db) return db;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not set in the environment.');
    }

    client = new MongoClient(uri);
    await client.connect();

    db = client.db(process.env.MONGODB_DB || 'secret-santa');

    // Basic indexes for uniqueness and lookup speed.
    await Promise.all([
        getUsersCollection().createIndex({ email: 1 }, { unique: true }),
        getExclusionsCollection().createIndex({ aId: 1, bId: 1 }, { unique: true })
    ]);

    return db;
}

async function closeDb() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}

module.exports = {
    initDb,
    getUsersCollection,
    getDrawCollection,
    getExclusionsCollection,
    closeDb
};
