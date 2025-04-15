const chalk = require('chalk');

/**
 * Formats a log entry based on its tag
 * @param {string} log - The log entry to format
 * @returns {string} - The formatted log entry
 */
function formatTaggedLog(log) {
    if (log.includes('[')) {
        const tagMatch = log.match(/\[(.*?)\]/);
        if (tagMatch) {
            const tag = tagMatch[1];
            const tagIndex = log.indexOf(`[${tag}]`);
            const beforeTag = log.substring(0, tagIndex);
            const afterTag = log.substring(tagIndex + tag.length + 2);
            
            switch(tag.toLowerCase()) {
                case 'important': 
                    return chalk.red(log);
                case 'idea': 
                    return chalk.green(log);
                case 'todo': 
                    return chalk.blue(log);
                default: 
                    // Format only the tag in cyan, keep the rest of the log as is
                    return beforeTag + chalk.cyan(`[${tag}]`) + afterTag;
            }
        }
    }
    return log;
}

/**
 * Checks if a log entry contains a tag
 * @param {string} log - The log entry to check
 * @returns {boolean} - Whether the log entry contains a tag
 */
function hasTag(log) {
    return log.includes('[') && log.match(/\[(.*?)\]/);
}

/**
 * Extracts the tag from a log entry
 * @param {string} log - The log entry to extract from
 * @returns {string|null} - The extracted tag or null if no tag found
 */
function extractTag(log) {
    if (hasTag(log)) {
        const tagMatch = log.match(/\[(.*?)\]/);
        return tagMatch[1];
    }
    return null;
}

/**
 * Creates a tagged message
 * @param {string} tag - The tag to add
 * @param {string} message - The message to tag
 * @returns {string} - The tagged message
 */
function createTaggedMessage(tag, message) {
    return `[${tag}] ${message}`;
}

module.exports = {
    formatTaggedLog,
    hasTag,
    extractTag,
    createTaggedMessage
};