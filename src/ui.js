const readline = require('readline');
const chalk = require('chalk');
const config = require('./config');
const logger = require('./logger');
const backup = require('./backup');
const tag = require('./tag');

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
    
    console.log(chalk.bold.green(`${currentSection} (section) - ${logger.getCurrentDateTime()}`));

    if (description) {
        console.log(chalk.cyan(`${description}`));
    }
    console.log(chalk.dim('type "/help" for commands or "/menu" to return to menu'));
    
    if (headerMessage) {
        console.log(headerMessage);
    }
    
    const maxLogs = getMaxLogsForTerminal();
    
    const displayLogs = logsToDisplay || logs.slice(-maxLogs);
    
    if (displayLogs.length === 0) {
        console.log(chalk.dim('no logs to display. type a thought and press enter'));
    } else {
        if (!logsToDisplay && logs.length > maxLogs) {
            console.log(chalk.dim(`Showing most recent ${maxLogs} of ${logs.length} logs`));
        }
        
        displayLogs.forEach(log => {
            if (tag.hasTag(log)) {
                console.log(tag.formatTaggedLog(log));
                return;
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
    
    console.log(chalk.cyan('select a section to log your thoughts:'));
    
    const sections = logger.getSections();
    const metadata = logger.getSectionMetadata();
    
    if (sections.length === 0) {
        console.log(chalk.yellow('no sections found. Create your first section:'));
    } else {
        console.log(chalk.bold('available sections:'));
        
        if (sections.includes(config.defaultSection)) {
            const baseDesc = metadata[config.defaultSection]?.description || 'general thoughts';
            console.log(`${chalk.green('b')}. ${config.defaultSection} - ${chalk.dim(baseDesc)}`);
        }
        
        const otherSections = sections.filter(s => s !== config.defaultSection);
        otherSections.forEach((section, index) => {
            const desc = metadata[section]?.description || 'no description';
            console.log(`${chalk.green(index + 1)}. ${section} - ${chalk.dim(desc)}`);
        });
    }
    
    console.log('\n' + chalk.green('n') + '. create new section');
    console.log(chalk.green('x') + '. exit');
    
    rl.question('enter your choice: ', (answer) => {
        if (answer.toLowerCase() === 'x') {
            rl.close();
            return;
        }
        
        if (answer.toLowerCase() === 'b') {
            startLogger(config.defaultSection);
            return;
        }
        
        if (answer.toLowerCase() === 'n') {
            rl.question(`enter new section name (max ${config.maxSectionNameLength} chars): `, (sectionName) => {
                if (sectionName.trim() === '') {
                    console.log(chalk.yellow('section name cannot be empty'));
                    setTimeout(showMainMenu, 1500);
                    return;
                }
                
                if (sectionName.length > config.maxSectionNameLength) {
                    console.log(chalk.yellow(`section name too long (max ${config.maxSectionNameLength} chars)`));
                    setTimeout(showMainMenu, 1500);
                    return;
                }
                
                rl.question(`enter section description (max ${config.maxDescriptionLength} chars): `, (description) => {
                    if (description.length > config.maxDescriptionLength) {
                        console.log(chalk.yellow(`description too long (max ${config.maxDescriptionLength} chars)`));
                        setTimeout(showMainMenu, 1500);
                        return;
                    }
                    
                    const newSection = logger.createSection(sectionName, description);
                    console.log(chalk.green(`created section: ${newSection}`));
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
            console.log(chalk.red('invalid selection'));
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
        console.log(chalk.cyan(`description: ${description}`));
    }
    console.log('loading previous logs...');
    
    logs = logger.loadAllLogs(section);
    
    console.log(`Loaded ${logs.length} log entries`);
    console.log(chalk.dim('type "/menu" to return to section menu or "/exit" to quit'));
    
    startClock();
}

// command handlers
const commands = {
    '/help': () => {
        isDisplayingHelp = true;
        console.clear();
        console.log(chalk.bold.green('=== THOUGHT LOGGER COMMANDS ==='));
        console.log(chalk.cyan('/help') + ' - display this help message');
        console.log(chalk.cyan('/clear') + ' - clear the display (logs remain saved)');
        console.log(chalk.cyan('/search <term>') + ' - search for logs containing a term');
        console.log(chalk.cyan('/tag <tag> <message>') + ' - add a tagged thought');
        console.log(chalk.cyan('/count') + ' - show total number of logs');
        console.log(chalk.cyan('/today') + ' - show only today\'s logs');
        console.log(chalk.cyan('/backup') + ' - create backup of current section');
        console.log(chalk.cyan('/backup-all') + ' - create full backup of all sections');
        console.log(chalk.cyan('/list-backups') + ' - list all available backups');
        console.log(chalk.cyan('/restore [type] [number]') + ' - restore from backup');
        console.log(chalk.cyan('/menu') + ' - return to section selection menu');
        console.log(chalk.cyan('/exit') + ' - exit the program');
        console.log(chalk.bold.green('============================='));
        console.log('press any key to return to the logger...');
        
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
            console.log(chalk.yellow('please provide a search term'));
            return;
        }
        const searchResults = logs.filter(log => 
            log.toLowerCase().includes(term.toLowerCase())
        );
        
        updateDisplay(searchResults, true, 
            chalk.yellow(`search results for "${term}" (${searchResults.length} matches):`));
    },
    
    '/tag': (tagName, ...messageParts) => {
        if (!tagName || messageParts.length === 0) {
            console.log(chalk.yellow('usage: /tag <tag> <message>'));
            return;
        }
        const fullMessage = messageParts.join(' ');
        logMessage(tag.createTaggedMessage(tagName, fullMessage));
    },
    
    '/count': () => {
        console.log(chalk.cyan(`total logs: ${logs.length}`));
    },
    
    '/today': () => {
        const today = new Date().toLocaleDateString();
        const todaysLogs = logs.filter(log => log.includes(today));
        updateDisplay(todaysLogs, true, 
            chalk.yellow(`today's logs (${todaysLogs.length}):`));
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
            const allBackups = backup.listBackups();
            if (!allBackups || allBackups.length === 0) {
                console.log(chalk.red('No backups found.'));
                return;
            }
            
            // Filter backups for current section
            const sectionBackups = allBackups.filter(b => 
                b.type === 'section' && b.section === currentSection
            );
            
            if (sectionBackups.length === 0) {
                console.log(chalk.yellow(`No backups found for section: ${currentSection}`));
                console.log(chalk.cyan('To see all backups, use /list-backups command'));
                return;
            }
            
            console.log(chalk.cyan(`Available backups for section [${currentSection}]:`));
            sectionBackups.forEach((backup, index) => {
                console.log(chalk.green(`${index + 1}. ${backup.date} (${backup.size})`));
            });
            
            console.log(chalk.yellow('\nTo restore: /restore section <number>'));
            return;
        }
        
        // Case 2: Restore using type and number format (from /list-backups)
        if ((type === 'full' || type === 'section') && number) {
            const fs = require('fs');
            const path = require('path');
            
            // Get all backups directly using the working function
            const allBackups = backup.listBackups();
            if (!allBackups || allBackups.length === 0) {
                console.log(chalk.red('no backups found.'));
                return;
            }
            
            // Filter backups by type
            const typeBackups = allBackups.filter(b => {
                if (type === 'full') return b.type === 'full';
                if (type === 'section') return b.type === 'section';
                return false;
            });
            
            if (typeBackups.length === 0) {
                console.log(chalk.red(`no ${type} backups found.`));
                return;
            }
            
            const index = parseInt(number) - 1;
            if (isNaN(index) || index < 0 || index >= typeBackups.length) {
                console.log(chalk.red(`invalid backup number. choose 1-${typeBackups.length}`));
                return;
            }
            
            const backupToRestore = typeBackups[index];
            if (!backupToRestore || !backupToRestore.path || !fs.existsSync(backupToRestore.path)) {
                console.log(chalk.red(`backup file not found at: ${backupToRestore ? backupToRestore.path : 'unknown path'}`));
                return;
            }
            
            console.log(chalk.yellow(`restoring from backup: ${backupToRestore.filename || backupToRestore.name || 'unknown'}`));
            
            const promptMsg = 'this will overwrite current data. proceed? (y/n): ';
            rl.question(promptMsg, (answer) => {
                if (answer.toLowerCase() === 'y') {
                    const success = backup.restoreFromBackup(
                        backupToRestore.path,
                        type === 'section' ? currentSection : null,
                        true
                    );
                    
                    if (success) {
                        console.log(chalk.green('restoration completed successfully'));
                        logs = logger.loadAllLogs(currentSection);
                        updateDisplay();
                    } else {
                        console.log(chalk.red('restoration failed. please check the logs.'));
                    }
                } else {
                    console.log(chalk.yellow('restoration cancelled'));
                }
            });
            return;
        }
        
        // Case 3: Invalid arguments
        console.log(chalk.yellow('Usage: /restore [type] [number]'));
        console.log(chalk.yellow('Types: "section" or "full"'));
        console.log(chalk.yellow('Use /list-backups to see available backups'));
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
                console.log(chalk.yellow(`unknown command: ${cmd}. type /help for available commands.`));
            }
        } else {
            logMessage(trimmed);
        }
    });
    
    rl.on('close', () => {
        if (clockInterval) clearInterval(clockInterval);
        console.log(chalk.green('\nthought logger closed'));
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