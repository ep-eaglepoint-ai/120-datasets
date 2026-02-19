/**
 * Wrapper to load utils.js files that don't have module.exports
 * This evaluates the file in a context and extracts the functions
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadUtils(modulePath) {
    const filePath = path.join(__dirname, modulePath);
    const code = fs.readFileSync(filePath, 'utf-8');
    
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        module: { exports: {} },
        exports: {}
    };
    
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    
    // Extract functions from the sandbox
    return {
        processUserData: sandbox.processUserData,
        calculateTotal: sandbox.calculateTotal,
        findUser: sandbox.findUser,
        fetchData: sandbox.fetchData,
        config: sandbox.config
    };
}

module.exports = loadUtils;
