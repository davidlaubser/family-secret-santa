// utils/draw.js

/**
 * participants: [{ id, name, email, notes }]
 * exclusions: [{ id, aId, bId }]
 * Returns: [{ giverId, receiverId }] or null if impossible.
 */

function buildExclusionMap(exclusions) {
    const map = new Map(); // giverId -> Set(forbiddenReceiverIds)

    function addPair(a, b) {
        if (!map.has(a)) map.set(a, new Set());
        map.get(a).add(b);
    }

    for (const ex of exclusions) {
        // Treat as symmetric: A cannot get B and B cannot get A
        addPair(ex.aId, ex.bId);
        addPair(ex.bId, ex.aId);
    }
    return map;
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function runDraw(participants, exclusions) {
    if (!participants || participants.length < 2) {
        return null;
    }

    const ids = participants.map(p => p.id);
    const exclusionMap = buildExclusionMap(exclusions || []);

    function isForbidden(giverId, receiverId) {
        if (giverId === receiverId) return true; // no self
        const set = exclusionMap.get(giverId);
        return set ? set.has(receiverId) : false;
    }

    const assignments = [];
    const used = new Set();

    function backtrack(index) {
        if (index === ids.length) {
            return true;
        }

        const giverId = ids[index];
        const available = ids.filter(id => !used.has(id));

        const candidates = shuffle(available); // random order

        for (const candidate of candidates) {
            if (isForbidden(giverId, candidate)) continue;

            used.add(candidate);
            assignments.push({ giverId, receiverId: candidate });

            if (backtrack(index + 1)) return true;

            assignments.pop();
            used.delete(candidate);
        }

        return false;
    }

    const success = backtrack(0);
    if (!success) return null;
    return assignments;
}

module.exports = {
    runDraw
};
