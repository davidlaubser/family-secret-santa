// utils/db.js
const fs = require('fs').promises;
const path = require('path');

async function readJson(filePath, defaultValue) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await writeJson(filePath, defaultValue);
            return defaultValue;
        }
        throw err;
    }
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
    readJson,
    writeJson
};
