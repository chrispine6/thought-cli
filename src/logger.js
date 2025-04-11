const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');

function getLogFilePath(section) {
    return path.join(config.sectionsDir, `${section}.txt`);
}

function getSectionMetadata() {
    try {
        if (fs.existsSync(config.metadataFile)) {
            const data = fs.readFileSync(config.metadataFile, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error(chalk.red('Error loading section metadata:'), err);
    }
    return {};
}

function saveSectionMetadata(metadata) {
    try {
        fs.writeFileSync(config.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (err) {
        console.error(chalk.red('Error saving section metadata:'), err);
    }
}

function getSections() {
    try {
        const files = fs.readdirSync(config.sectionsDir);
        return files
            .filter(file => file.endsWith('.txt') && file !== 'metadata.json')
            .map(file => file.replace('.txt', ''));
    } catch (err) {
        console.error(chalk.red('Error loading sections:'), err);
        return [];
    }
}

function createSection(name, description) {
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const logFilePath = getLogFilePath(sanitizedName);
    
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '');
    }
    
    const metadata = getSectionMetadata();
    metadata[sanitizedName] = { description };
    saveSectionMetadata(metadata);
    
    return sanitizedName;
}

function ensureDefaultSection() {
    const sections = getSections();
    if (!sections.includes(config.defaultSection)) {
        createSection(config.defaultSection, 'General thoughts');
        console.log(chalk.green(`Created default section: ${config.defaultSection}`));
    }
}

function getCurrentDateTime(includeSeconds = false) {
    const now = new Date();
    const date = now.toLocaleDateString();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    if (includeSeconds) {
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${date}, ${hours}:${minutes}:${seconds}`;
    }
    
    return `${date}, ${hours}:${minutes}`;
}

function loadAllLogs(section) {
    try {
        const logFilePath = getLogFilePath(section);
        if (fs.existsSync(logFilePath)) {
            return fs.readFileSync(logFilePath, 'utf-8')
                .trim()
                .split('\n')
                .filter(line => line.trim() !== '');
        }
    } catch (err) {
        console.error(chalk.red('Error loading logs:'), err);
    }
    return [];
}

function saveLog(section, logEntry) {
    try {
        const logFilePath = getLogFilePath(section);
        fs.appendFileSync(logFilePath, logEntry + '\n');
        
        const stats = fs.statSync(logFilePath);
        return stats.size > config.logRotationSize;
    } catch (err) {
        console.error(chalk.red('Error saving log:'), err);
        return false;
    }
}

function createBackup(section, rotate = false) {
    try {
        const logFilePath = getLogFilePath(section);
        if (fs.existsSync(logFilePath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(config.backupDir, `${section}-${timestamp}.bak`);
            
            fs.copyFileSync(logFilePath, backupPath);
            
            if (rotate) {
                fs.writeFileSync(logFilePath, '');
                return true;
            } else {
                console.log(chalk.green(`Logs backed up to ${backupPath}`));
                return false;
            }
        }
    } catch (err) {
        console.error(chalk.red('Error creating backup:'), err);
    }
    return false;
}

function ensureDirectories() {
    if (!fs.existsSync(config.backupDir)) {
        fs.mkdirSync(config.backupDir, { recursive: true });
    }
    if (!fs.existsSync(config.sectionsDir)) {
        fs.mkdirSync(config.sectionsDir, { recursive: true });
    }
}

module.exports = {
    getLogFilePath,
    getSectionMetadata,
    saveSectionMetadata,
    getSections,
    createSection,
    ensureDefaultSection,
    getCurrentDateTime,
    loadAllLogs,
    saveLog,
    createBackup,
    ensureDirectories
};