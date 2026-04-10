const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/watchlist.json');

function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getAll() {
    return readDB();
}

function exists(id) {
    return readDB().some(a => a.id === id);
}

function add(anime) {
    const list = readDB();
    if (!list.some(a => a.id === anime.id)) {
        list.push(anime);
        writeDB(list);
        return true;
    }
    return false;
}

function remove(id) {
    let list = readDB();
    const before = list.length;
    list = list.filter(a => a.id !== id);
    writeDB(list);
    return list.length < before;
}

function getIds() {
    return readDB().map(a => a.id);
}

const NOTIFIED_PATH = path.join(__dirname, '../../data/notified.json');

function getNotified() {
    try {
        const data = fs.readFileSync(NOTIFIED_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function addNotified(key) {
    const list = getNotified();
    if (!list.includes(key)) {
        list.push(key);
        if (list.length > 200) list.shift(); // Garder uniquement les 200 derniers pour éviter un gros fichier
        fs.writeFileSync(NOTIFIED_PATH, JSON.stringify(list, null, 2), 'utf8');
    }
}

module.exports = { getAll, exists, add, remove, getIds, getNotified, addNotified };
