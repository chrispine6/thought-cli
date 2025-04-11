const logger = require('./src/logger');
const ui = require('./src/ui');

function init() {
    logger.ensureDirectories();
    logger.ensureDefaultSection();
    ui.setupEventListeners();
    ui.showMainMenu();
}

// initiate thought-cli
init();