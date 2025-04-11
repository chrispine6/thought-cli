const readline = require('readline');
const chalk = require('chalk');
const config = require('./config');
const logger = require('./logger');
const backup = require('./backup');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    historySize: 100
});

let clockInterval;
let logs = [];
let isDisplayingHelp = false;
let currentSection = null;

function getMaxLogsForTerminal() {
    const terminalRows = process.stdout.rows || 24;
    
    const metadata = logger.getSectionMetadata();
    const hasDescription = metadata[currentSection]?.description ? 1 : 0;

    const reservedLines = 6 + hasDescription;
    
    return Math.max(5, terminalRows - reservedLines);
}

function updateDisplay(logsToDisplay = null, forceRefresh = false, headerMessage = null) {
    if (isDisplayingHelp && !forceRefresh) return;
    
    console.clear();
    
    const metadata = logger.getSectionMetadata();
    const description = metadata[currentSection]?.description || '';
    
    console.log(chalk.bold.green(`thought cli [${currentSection}] - ${logger.getCurrentDateTime()}`));

    if (description) {
        console.log(chalk.cyan(`Description: ${description}`));
    }
    console.log(chalk.dim('Type "/help" for commands or "/menu" to return to menu'));
    
    if (headerMessage) {
        console.log(headerMessage);
    }
    
    const maxLogs = getMaxLogsForTerminal();
    
    const displayLogs = logsToDisplay || logs.slice(-maxLogs);
    
    if (displayLogs.length === 0) {
        console.log(chalk.dim('No logs to display. Type a thought and press Enter.'));
    } else {
        if (!logsToDisplay && logs.length > maxLogs) {
            console.log(chalk.dim(`Showing most recent ${maxLogs} of ${logs.length} logs`));
        }
        
        displayLogs.forEach(log => {
            if (log.includes('[')) {
                const tagMatch = log.match(/\[(.*?)\]/);
                if (tagMatch) {
                    const tag = tagMatch[1];
                    switch(tag.toLowerCase()) {
                        case 'important': 
                            console.log(chalk.red(log)); 
                            break;
                        case 'idea': 
                            console.log(chalk.green(log)); 
                            break;
                        case 'todo': 
                            console.log(chalk.blue(log)); 
                            break;
                        default: 
                            console.log(chalk.cyan(`[${tag}]`) + log.substring(tag.length + 2));
                    }
                    return;
                }
            }
            console.log(log);
        });
    }
    
    rl.prompt(true);
}

function startClock() {
    clockInterval = setInterval(() => updateDisplay(), config.updateInterval);
    updateDisplay();
}

function logMessage(message) {
    const logEntry = `${logger.getCurrentDateTime(true)} ${message}`;
    logs.push(logEntry);
    
    const needsRotation = logger.saveLog(currentSection, logEntry);
    
    if (needsRotation) {
        const rotated = logger.createBackup(currentSection, true);
        if (rotated) {
            logs = [];
            logMessage('[SYSTEM] Log file rotated, previous logs backed up');
        }
    }
    
    updateDisplay();
}

function showMainMenu() {
    console.clear();
    console.log(chalk.bold.green(`
    ████████╗██╗  ██╗ ██████╗ ██╗   ██╗ ██████╗ ██╗  ██╗████████╗      ██████╗██╗     ██╗
    ╚══██╔══╝██║  ██║██╔═══██╗██║   ██║██╔════╝ ██║  ██║╚══██╔══╝     ██╔════╝██║     ██║
       ██║   ███████║██║   ██║██║   ██║██║  ███╗███████║   ██║        ██║     ██║     ██║
       ██║   ██╔══██║██║   ██║██║   ██║██║   ██║██╔══██║   ██║        ██║     ██║     ██║
       ██║   ██║  ██║╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║   ██║        ╚██████╗███████╗██║
       ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝         ╚═════╝╚══════╝╚═╝                                                                          
    `));
    
    console.log(chalk.cyan('Select a section to log your thoughts:'));
    
    const sections = logger.getSections();
    const metadata = logger.getSectionMetadata();
    
    if (sections.length === 0) {
        console.log(chalk.yellow('No sections found. Create your first section:'));
    } else {
        console.log(chalk.bold('Available sections:'));
        
        if (sections.includes(config.defaultSection)) {
            const baseDesc = metadata[config.defaultSection]?.description || 'General thoughts';
            console.log(`${chalk.green('b')}. ${config.defaultSection} - ${chalk.dim(baseDesc)}`);
        }
        
        const otherSections = sections.filter(s => s !== config.defaultSection);
        otherSections.forEach((section, index) => {
            const desc = metadata[section]?.description || 'No description';
            console.log(`${chalk.green(index + 1)}. ${section} - ${chalk.dim(desc)}`);
        });
    }
    
    console.log('\n' + chalk.green('n') + '. Create new section');
    console.log(chalk.green('x') + '. Exit');
    
    rl.question('Enter your choice: ', (answer) => {
        if (answer.toLowerCase() === 'x') {
            rl.close();
            return;
        }
        
        if (answer.toLowerCase() === 'b') {
            startLogger(config.defaultSection);
            return;
        }
        
        if (answer.toLowerCase() === 'n') {
            rl.question(`Enter new section name (max ${config.maxSectionNameLength} chars): `, (sectionName) => {
                if (sectionName.trim() === '') {
                    console.log(chalk.yellow('Section name cannot be empty'));
                    setTimeout(showMainMenu, 1500);
                    return;
                }
                
                if (sectionName.length > config.maxSectionNameLength) {
                    console.log(chalk.yellow(`Section name too long (max ${config.maxSectionNameLength} chars)`));
                    setTimeout(showMainMenu, 1500);
                    return;
                }
                
                rl.question(`Enter section description (max ${config.maxDescriptionLength} chars): `, (description) => {
                    if (description.length > config.maxDescriptionLength) {
                        console.log(chalk.yellow(`Description too long (max ${config.maxDescriptionLength} chars)`));
                        setTimeout(showMainMenu, 1500);
                        return;
                    }
                    
                    const newSection = logger.createSection(sectionName, description);
                    console.log(chalk.green(`Created section: ${newSection}`));
                    setTimeout(() => {
                        startLogger(newSection);
                    }, 1000);
                });
            });
            return;
        }
        
        const choice = parseInt(answer);

        const sections = logger.getSections().filter(s => s !== config.defaultSection);
        
        if (isNaN(choice) || choice < 1 || choice > sections.length) {
            console.log(chalk.red('Invalid selection'));
            setTimeout(showMainMenu, 1500);
            return;
        }
        
        startLogger(sections[choice - 1]);
    });
}

function startLogger(section) {
    currentSection = section;
    console.clear();
    
    const metadata = logger.getSectionMetadata();
    const description = metadata[section]?.description || '';
    
    console.log(chalk.bold.green(`=== THOUGHT LOGGER: ${section} ===`));
    if (description) {
        console.log(chalk.cyan(`Description: ${description}`));
    }
    console.log('Loading previous logs...');
    
    logs = logger.loadAllLogs(section);
    
    console.log(`Loaded ${logs.length} log entries`);
    console.log(chalk.dim('Type "/menu" to return to section menu or "/exit" to quit'));
    
    startClock();
}

// command handlers
const commands = {
    '/help': () => {
        isDisplayingHelp = true;
        console.clear();
        console.log(chalk.bold.green('=== THOUGHT LOGGER COMMANDS ==='));
        console.log(chalk.cyan('/help') + ' - Display this help message');
        console.log(chalk.cyan('/clear') + ' - Clear the display (logs remain saved)');
        console.log(chalk.cyan('/search <term>') + ' - Search for logs containing a term');
        console.log(chalk.cyan('/tag <tag> <message>') + ' - Add a tagged thought');
        console.log(chalk.cyan('/count') + ' - Show total number of logs');
        console.log(chalk.cyan('/today') + ' - Show only today\'s logs');
        console.log(chalk.cyan('/backup') + ' - Create backup of current section');
        console.log(chalk.cyan('/backup-all') + ' - Create full backup of all sections');
        console.log(chalk.cyan('/list-backups') + ' - List all available backups');
        console.log(chalk.cyan('/restore [type] [number]') + ' - Restore from backup');
        console.log(chalk.cyan('/menu') + ' - Return to section selection menu');
        console.log(chalk.cyan('/exit') + ' - Exit the program');
        console.log(chalk.bold.green('============================='));
        console.log('Press any key to return to the logger...');
        
        process.stdin.once('data', () => {
            isDisplayingHelp = false;
            updateDisplay();
        });
    },
    
    '/clear': () => {
        logs = logger.loadAllLogs(currentSection); 
        updateDisplay([], true);
    },
    
    '/search': (term) => {
        if (!term) {
            console.log(chalk.yellow('Please provide a search term'));
            return;
        }
        const searchResults = logs.filter(log => 
            log.toLowerCase().includes(term.toLowerCase())
        );
        
        updateDisplay(searchResults, true, 
            chalk.yellow(`Search results for "${term}" (${searchResults.length} matches):`));
    },
    
    '/tag': (tag, message) => {
        if (!tag || !message) {
            console.log(chalk.yellow('Usage: /tag <tag> <message>'));
            return;
        }
        logMessage(`[${tag}] ${message}`);
    },
    
    '/count': () => {
        console.log(chalk.cyan(`Total logs: ${logs.length}`));
    },
    
    '/today': () => {
        const today = new Date().toLocaleDateString();
        const todaysLogs = logs.filter(log => log.includes(today));
        updateDisplay(todaysLogs, true, 
            chalk.yellow(`Today's logs (${todaysLogs.length}):`));
    },
    
    '/backup': () => {
        backup.backupSection(currentSection);
    },
    
    '/backup-all': () => {
        backup.createFullBackup();
    },
    
    '/restore': (type, number) => {
        // Case 1: No arguments - show available backups for current section
        if (!type) {
            // Existing code for showing backups...
            return;
        }
        
        // Case 2: Restore using type and number format (from /list-backups)
        if ((type === 'full' || type === 'section') && number) {
            const fs = require('fs');
            const path = require('path');
            
            // Get all backups directly using the working function
            const allBackups = backup.listBackups();
            if (!allBackups || allBackups.length === 0) {
                console.log(chalk.red('No backups found.'));
                return;
            }
            
            // Filter backups by type
            const typeBackups = allBackups.filter(b => {
                if (type === 'full') return b.type === 'full';
                if (type === 'section') return b.type === 'section';
                return false;
            });
            
            if (typeBackups.length === 0) {
                console.log(chalk.red(`No ${type} backups found.`));
                return;
            }
            
            const index = parseInt(number) - 1;
            if (isNaN(index) || index < 0 || index >= typeBackups.length) {
                console.log(chalk.red(`Invalid backup number. Choose 1-${typeBackups.length}`));
                return;
            }
            
            const backupToRestore = typeBackups[index];
            if (!backupToRestore || !backupToRestore.path || !fs.existsSync(backupToRestore.path)) {
                console.log(chalk.red(`Backup file not found at: ${backupToRestore ? backupToRestore.path : 'unknown path'}`));
                return;
            }
            
            console.log(chalk.yellow(`Restoring from backup: ${backupToRestore.filename || backupToRestore.name || 'unknown'}`));
            
            const promptMsg = 'This will overwrite current data. Proceed? (y/n): ';
            rl.question(promptMsg, (answer) => {
                if (answer.toLowerCase() === 'y') {
                    const success = backup.restoreFromBackup(
                        backupToRestore.path,
                        type === 'section' ? currentSection : null,
                        true
                    );
                    
                    if (success) {
                        console.log(chalk.green('Restoration completed successfully'));
                        logs = logger.loadAllLogs(currentSection);
                        updateDisplay();
                    } else {
                        console.log(chalk.red('Restoration failed. Please check the logs.'));
                    }
                } else {
                    console.log(chalk.yellow('Restoration cancelled'));
                }
            });
            return;
        }
        
        // Rest of existing code...
    },
    
    '/list-backups': () => {
        backup.listBackups();
    },
    
    '/menu': () => {
        clearInterval(clockInterval);
        showMainMenu();
    },
    
    '/exit': () => {
        rl.close();
    }
};

function setupEventListeners() {
    rl.on('line', (input) => {
        if (currentSection === null) return;
        
        const trimmed = input.trim();
        
        if (trimmed === '') {
            updateDisplay();
            return;
        }
        
        if (trimmed.startsWith('/')) {
            const parts = trimmed.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);
            
            if (commands[cmd]) {
                commands[cmd](...args);
            } else {
                console.log(chalk.yellow(`Unknown command: ${cmd}. Type /help for available commands.`));
            }
        } else {
            logMessage(trimmed);
        }
    });
    
    rl.on('close', () => {
        if (clockInterval) clearInterval(clockInterval);
        console.log(chalk.green('\nThought Logger closed'));
        process.exit(0);
    });
}

module.exports = {
    rl,
    showMainMenu,
    setupEventListeners,
    logMessage,
    startLogger
};