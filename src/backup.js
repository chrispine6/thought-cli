const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');
const zlib = require('zlib');

/**
 * Backup management system for thought-cli
 * Provides regular backups, compression, and recovery capabilities
 */

const backupConfig = {
    maxBackupsPerSection: 5,
    retentionDays: 30,
    useCompression: true,
    backupExtension: '.bak',
    compressedExtension: '.bak.gz',
    fullBackupPrefix: 'full-backup-'
};

/**
 * Creates a backup of a specific section
 * @param {string} section - The section name to backup
 * @param {boolean} rotate - Whether to clear the log file after backup
 * @returns {string|null} - Path to the backup file or null if failed
 */
function backupSection(section, rotate = false) {
    try {
        const logFilePath = path.join(config.sectionsDir, `${section}.txt`);
        
        if (!fs.existsSync(logFilePath)) {
            console.log(chalk.yellow(`no log file found for section: ${section}`));
            return null;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${section}-${timestamp}${backupConfig.backupExtension}`;
        const backupPath = path.join(config.backupDir, backupFileName);
        
        const content = fs.readFileSync(logFilePath, 'utf-8');
        
        if (backupConfig.useCompression) {
            const compressed = zlib.gzipSync(content);
            const compressedPath = backupPath + '.gz';
            fs.writeFileSync(compressedPath, compressed);
            
            if (rotate) {
                fs.writeFileSync(logFilePath, '');
            }
            
            console.log(chalk.green(`compressed backup created: ${compressedPath}`));
            cleanupOldBackups(section);
            return compressedPath;
        } else {
            fs.writeFileSync(backupPath, content);
            
            if (rotate) {
                fs.writeFileSync(logFilePath, '');
            }
            
            console.log(chalk.green(`backup created: ${backupPath}`));
            cleanupOldBackups(section);
            return backupPath;
        }
    } catch (err) {
        console.error(chalk.red(`error creating backup for section ${section}:`), err);
        return null;
    }
}

/**
 * Creates a full backup of all sections and metadata
 * @returns {string|null} - Path to the full backup file or null if failed
 */
function createFullBackup() {
    try {
        if (!fs.existsSync(config.backupDir)) {
            fs.mkdirSync(config.backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${backupConfig.fullBackupPrefix}${timestamp}${backupConfig.backupExtension}`;
        const backupPath = path.join(config.backupDir, backupFileName);
        
        const sections = getSections();
        
        const backupData = {
            timestamp: new Date().toISOString(),
            metadata: {},
            sections: {}
        };
        
        if (fs.existsSync(config.metadataFile)) {
            const metadataContent = fs.readFileSync(config.metadataFile, 'utf-8');
            backupData.metadata = JSON.parse(metadataContent);
        }
        
        for (const section of sections) {
            const logFilePath = path.join(config.sectionsDir, `${section}.txt`);
            if (fs.existsSync(logFilePath)) {
                const content = fs.readFileSync(logFilePath, 'utf-8');
                backupData.sections[section] = content;
            }
        }
        
        const backupContent = JSON.stringify(backupData, null, 2);
        
        if (backupConfig.useCompression) {
            const compressed = zlib.gzipSync(backupContent);
            const compressedPath = backupPath + '.gz';
            fs.writeFileSync(compressedPath, compressed);
            console.log(chalk.green(`full compressed backup created: ${compressedPath}`));
            cleanupOldFullBackups();
            return compressedPath;
        } else {
            fs.writeFileSync(backupPath, backupContent);
            console.log(chalk.green(`full backup created: ${backupPath}`));
            cleanupOldFullBackups();
            return backupPath;
        }
    } catch (err) {
        console.error(chalk.red('error creating full backup:'), err);
        return null;
    }
}

/**
 * Restores a section from a backup file
 * @param {string} backupPath - Path to the backup file
 * @param {string} section - Section name to restore (null for full backup)
 * @param {boolean} overwrite - Whether to overwrite existing data
 * @returns {boolean} - Whether restoration was successful
 */
function restoreFromBackup(backupPath, section = null, overwrite = false) {
    try {
        if (!fs.existsSync(backupPath)) {
            console.error(chalk.red(`backup file not found: ${backupPath}`));
            return false;
        }
        
        let backupContent;
        
        if (backupPath.endsWith('.gz')) {
            const compressed = fs.readFileSync(backupPath);
            backupContent = zlib.gunzipSync(compressed).toString();
        } else {
            backupContent = fs.readFileSync(backupPath, 'utf-8');
        }
        
        if (path.basename(backupPath).startsWith(backupConfig.fullBackupPrefix)) {
            return restoreFullBackup(JSON.parse(backupContent), overwrite);
        } else if (section) {
            return restoreSectionBackup(section, backupContent, overwrite);
        } else {
            console.error(chalk.red('section name required for individual backup restoration'));
            return false;
        }
    } catch (err) {
        console.error(chalk.red('error restoring from backup:'), err);
        return false;
    }
}

/**
 * Restores a full backup
 * @param {object} backupData - The parsed backup data
 * @param {boolean} overwrite - Whether to overwrite existing data
 * @returns {boolean} - Whether restoration was successful
 */
function restoreFullBackup(backupData, overwrite) {
    try {
        if (!fs.existsSync(config.sectionsDir)) {
            fs.mkdirSync(config.sectionsDir, { recursive: true });
        }
        
        if (backupData.metadata) {
            const metadataPath = config.metadataFile;
            if (overwrite || !fs.existsSync(metadataPath)) {
                fs.writeFileSync(metadataPath, JSON.stringify(backupData.metadata, null, 2));
                console.log(chalk.green('metadata restored'));
            } else {
                console.log(chalk.yellow('skipping metadata restoration (file exists)'));
            }
        }
        
        let successCount = 0;
        const sectionCount = Object.keys(backupData.sections).length;
        
        for (const [section, content] of Object.entries(backupData.sections)) {
            const logFilePath = path.join(config.sectionsDir, `${section}.txt`);
            
            if (overwrite || !fs.existsSync(logFilePath)) {
                fs.writeFileSync(logFilePath, content);
                successCount++;
            } else {
                console.log(chalk.yellow(`skipping section ${section} (file exists)`));
            }
        }
        
        console.log(chalk.green(`restored ${successCount} of ${sectionCount} sections`));
        return true;
    } catch (err) {
        console.error(chalk.red('error restoring full backup:'), err);
        return false;
    }
}

/**
 * Restores a single section from backup content
 * @param {string} section - Section name to restore
 * @param {string} content - Content to restore
 * @param {boolean} overwrite - Whether to overwrite existing data
 * @returns {boolean} - Whether restoration was successful
 */
function restoreSectionBackup(section, content, overwrite) {
    try {
        const logFilePath = path.join(config.sectionsDir, `${section}.txt`);
        
        if (overwrite || !fs.existsSync(logFilePath)) {
            fs.writeFileSync(logFilePath, content);
            console.log(chalk.green(`section ${section} restored successfully`));
            return true;
        } else {
            console.log(chalk.yellow(`skipping section ${section} (file exists)`));
            return false;
        }
    } catch (err) {
        console.error(chalk.red(`error restoring section ${section}:`), err);
        return false;
    }
}

/**
 * Lists all available backups
 * @param {Array} fullBackups - List of full backups
 * @param {Array} sectionBackups - List of section backups
 * @returns {Array} - Combined list of all backups
 */
function listBackups(fullBackups = null, sectionBackups = null) {
    if (!fullBackups || !sectionBackups) {
        const allBackups = listAllBackups(); // Fetch all backups
        fullBackups = allBackups.filter(b => b.type === 'full') || [];
        sectionBackups = allBackups.filter(b => b.type === 'section') || [];
    }

    console.log("Available backups:");

    // Number full backups separately
    console.log("Full backups:");
    if (fullBackups.length === 0) {
        console.log("No full backups available.");
    } else {
        fullBackups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.name} - ${backup.date} (${backup.size})`);
        });
    }

    // Number section backups separately
    console.log("Section backups:");
    if (sectionBackups.length === 0) {
        console.log("No section backups available.");
    } else {
        sectionBackups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.section}: ${backup.name} - ${backup.date} (${backup.size})`);
        });
    }

    console.log("Use /restore <type> <number> to restore a specific backup");
    console.log("Example: /restore full 1 or /restore section 1");
    
    // Return the list of backups for programmatic use
    return [...fullBackups, ...sectionBackups];
}

/**
 * Fetches all backups from the backup directory
 * @returns {Array} - List of all backups
 */
function listAllBackups() {
    try {
        if (!fs.existsSync(config.backupDir)) {
            return [];
        }

        const files = fs.readdirSync(config.backupDir);
        return files.map(file => {
            const fullPath = path.join(config.backupDir, file);
            const stats = fs.statSync(fullPath);

            let type = 'unknown';
            let sectionName = null;

            if (file.startsWith(backupConfig.fullBackupPrefix)) {
                type = 'full';
            } else {
                type = 'section';
                const match = file.match(/^([^-]+)-/);
                if (match) {
                    sectionName = match[1];
                }
            }

            return {
                path: fullPath,
                name: file,
                date: stats.mtime,
                size: stats.size,
                type,
                section: sectionName
            };
        });
    } catch (err) {
        console.error(chalk.red('error listing backups:'), err);
        return [];
    }
}

/**
 * Schedules automatic backups
 * @param {number} intervalMinutes - Interval in minutes between backups
 * @returns {Object} - Timer object that can be used to cancel the schedule
 */
function scheduleBackups(intervalMinutes = 60) {
    console.log(chalk.green(`scheduling automatic backups every ${intervalMinutes} minutes`));
    
    createFullBackup();

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
        console.log(chalk.blue('running scheduled backup...'));
        createFullBackup();
    }, intervalMs);
    
    return timer;
}

/**
 * Clean up old backups for a specific section
 * @param {string} section - Section name
 */
function cleanupOldBackups(section) {
    try {
        // Use listAllBackups directly instead of listBackups which doesn't return anything
        const allBackups = listAllBackups();
        const backups = allBackups.filter(b => b.type === 'section' && b.section === section);
        
        if (backups.length > backupConfig.maxBackupsPerSection) {
            const toDelete = backups.slice(backupConfig.maxBackupsPerSection);
            
            for (const backup of toDelete) {
                fs.unlinkSync(backup.path);
                console.log(chalk.dim(`deleted old backup: ${backup.name}`));
            }
        }

        if (backupConfig.retentionDays > 0) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - backupConfig.retentionDays);
            
            const expiredBackups = backups.filter(b => b.date < cutoffDate);
            
            for (const backup of expiredBackups) {
                fs.unlinkSync(backup.path);
                console.log(chalk.dim(`deleted expired backup: ${backup.name}`));
            }
        }
    } catch (err) {
        console.error(chalk.red(`error cleaning up backups for section ${section}:`), err);
    }
}

/**
 * Clean up old full backups
 */
function cleanupOldFullBackups() {
    try {
        const backups = listBackups()
            .filter(b => b.type === 'full');
        
        if (backups.length > backupConfig.maxBackupsPerSection) {
            const toDelete = backups.slice(backupConfig.maxBackupsPerSection);
            
            for (const backup of toDelete) {
                fs.unlinkSync(backup.path);
                console.log(chalk.dim(`deleted old full backup: ${backup.filename}`));
            }
        }
        
        if (backupConfig.retentionDays > 0) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - backupConfig.retentionDays);
            
            const expiredBackups = backups.filter(b => b.date < cutoffDate);
            
            for (const backup of expiredBackups) {
                fs.unlinkSync(backup.path);
                console.log(chalk.dim(`deleted expired full backup: ${backup.filename}`));
            }
        }
    } catch (err) {
        console.error(chalk.red('error cleaning up full backups:'), err);
    }
}

/**
 * Helper function to get all sections
 * @returns {Array} - List of section names
 */
function getSections() {
    try {
        const files = fs.readdirSync(config.sectionsDir);
        return files
            .filter(file => file.endsWith('.txt') && file !== 'metadata.json')
            .map(file => file.replace('.txt', ''));
    } catch (err) {
        console.error(chalk.red('error loading sections:'), err);
        return [];
    }
}

/**
 * Restores a backup based on type and number
 * @param {string} type - Type of backup ("full" or "section")
 * @param {number} number - Backup number to restore
 * @param {Array} fullBackups - List of full backups
 * @param {Array} sectionBackups - List of section backups
 */
function restoreBackup(type, number, fullBackups, sectionBackups) {
    let backup;
    if (type === "full") {
        backup = fullBackups[number - 1];
    } else if (type === "section") {
        backup = sectionBackups[number - 1];
    }

    if (!backup) {
        console.log("Invalid backup number or type.");
        return;
    }

    console.log(`Restoring backup: ${backup.name}`);
    // Add logic to restore the selected backup
}

module.exports = {
    backupSection,
    createFullBackup,
    restoreFromBackup,
    listBackups,
    listAllBackups,
    scheduleBackups,
    backupConfig,
    restoreBackup
};