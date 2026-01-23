/**
 * Browser mocks for running PvPoke ranking generation in Node.js
 * This file provides minimal implementations of browser APIs used by PvPoke
 */

const fs = require('fs');
const path = require('path');

// Base path for data files
const DATA_PATH = path.join(__dirname, '../../src/data');

/**
 * Mock jQuery with just the functions PvPoke needs
 */
function createJQueryMock() {
    const $ = function(selector) {
        // Return empty jQuery-like object for DOM operations (not needed for ranking)
        return {
            insertAfter: () => {},
            eq: () => ({ insertAfter: () => {} }),
            each: () => {},
            attr: () => '',
            first: () => ({ attr: () => '' }),
            val: () => ''
        };
    };

    // AJAX mock - uses setImmediate to defer callback (mimics async behavior)
    $.ajax = function(options) {
        const url = options.url;
        const method = (options.type || 'GET').toUpperCase();

        // Ignore POST requests (write.php, convert_to_sqlite.php) - we handle saving ourselves
        if (method === 'POST') {
            // Silently ignore - our Node.js code handles file writing
            return;
        }

        // Extract relative path from URL
        let filePath = url.replace(/\?.*$/, ''); // Remove query string

        // Handle different URL patterns
        if (filePath.includes('data/')) {
            filePath = path.join(DATA_PATH, filePath.split('data/')[1]);
        }

        // Use setImmediate to defer callback, allowing rest of script to execute first
        setImmediate(() => {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                if (options.success) {
                    options.success(data);
                }
            } catch (err) {
                // Silently ignore errors for non-essential files
                if (options.error) {
                    // Don't log - just call error handler silently
                    options.error({}, err.message);
                }
            }
        });
    };

    // Synchronous getJSON
    $.getJSON = function(url, callback) {
        let filePath = url.replace(/\?.*$/, '');

        if (filePath.includes('data/')) {
            filePath = path.join(DATA_PATH, filePath.split('data/')[1]);
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            if (callback) {
                callback(data);
            }
        } catch (err) {
            console.error(`Failed to load ${filePath}:`, err.message);
        }
    };

    // Simple each implementation
    $.each = function(collection, callback) {
        if (Array.isArray(collection)) {
            collection.forEach((item, index) => callback(index, item));
        } else if (typeof collection === 'object') {
            Object.keys(collection).forEach(key => callback(key, collection[key]));
        }
    };

    return $;
}

/**
 * Mock InterfaceMaster - not needed for headless ranking
 */
const InterfaceMaster = {
    getInstance: () => ({
        init: () => {},
        Pokemon: () => {},
        Battle: () => {}
    }),
    getInterface: () => ({})
};

/**
 * Setup global environment for PvPoke scripts
 */
function setupGlobals() {
    // jQuery mock
    global.$ = createJQueryMock();
    global.jQuery = global.$;

    // Browser globals
    global.window = {
        localStorage: {
            getItem: () => null,
            setItem: () => {}
        },
        location: {
            href: ''
        }
    };
    global.document = {
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => ({
            style: {},
            href: '',
            download: '',
            click: () => {},
            appendChild: () => {},
            addEventListener: () => {}
        }),
        body: {
            appendChild: () => {},
            removeChild: () => {}
        }
    };

    // PvPoke globals
    global.host = 'localhost';
    global.webRoot = '';
    global.siteVersion = '1.0.0';
    global.settings = {
        gamemaster: 'gamemaster'
    };

    // InterfaceMaster mock
    global.InterfaceMaster = InterfaceMaster;

    // Empty functions that UI uses
    global.updateFormatSelect = () => {};
    global.updateCupSelect = () => {};
    global.customRankingInterface = undefined;
}

module.exports = {
    setupGlobals,
    createJQueryMock,
    InterfaceMaster,
    DATA_PATH
};
