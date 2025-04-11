const path = require('path');

const config = {
    baseDir: path.join(__dirname, '..'),
    sectionsDir: path.join(__dirname, '..', 'sections'),
    backupDir: path.join(__dirname, '..', 'backups'),
    maxLogsToDisplay: 20,
    updateInterval: 60000,
    logRotationSize: 5 * 1024 * 1024,
    metadataFile: path.join(__dirname, '..', 'sections', 'metadata.json'),
    maxSectionNameLength: 30,
    maxDescriptionLength: 100,
    defaultSection: 'base'
};

module.exports = config;