"use strict";

var path = require("path");
var fs = require("fs");

/**
 * Get the full path to the "Env Rules" file.
 * The file is under the "root folder" of the app project.
 *
 * NOTES:
 * If the target file does not exist, fall back to the default file - `environment-rules.json`.
 *
 * @param {String} envRulesFilename
 * @param {String} projectFolderPath
 * @returns
 */
exports.getEnvRulesFilePath = function(envRulesFilename, projectFolderPath) {
    const envRulesFileFullPath = path.join(projectFolderPath, envRulesFilename);
    if (fs.existsSync(envRulesFileFullPath)) {
        return envRulesFileFullPath;
    } else {
        // Default file - 'environment-rules.json'
        return path.join(projectFolderPath, 'environment-rules.json');
    }
}

/**
 * Load the contents form the "Env Rules" file.
 *
 * If not exist, return `undefined`.
 *
 * @param {String} envRulesFileFullPath
 * @returns
 */
exports.readEnvRules = function(envRulesFileFullPath) {
    if (fs.existsSync(envRulesFileFullPath)) {
        return JSON.parse(fs.readFileSync(envRulesFileFullPath).toString());
    }
    else {
        throw new Error('-o[NeoEnv]o--x "Environment Rules" file does not exist! Please check...');
    }
}
