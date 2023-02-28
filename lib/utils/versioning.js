"use strict";

const semverGt = require('semver/functions/gt')
const SemVer = require('semver/classes')

/**
 * Check if "version 1" is beyond "version 2".
 *
 * @param {String} version1
 * @param {String} version2
 * @returns
 */
exports.versionBumped = function(version1, version2) {
    return semverGt(version1, version2);
}


/**
 * Generate a "Version Code" based on the given "Version #" and "Build #".
 *
 * Rules:
 * - A "version #" of `1.2.1` will be translated to a number of `10201`.
 *  - The "miner #" and "patch #" are a 2-digit number with padding `0`.
 * - A "build #" of `2` will be translated to a number string `02` (2-digit number with padding `0`).
 * - Combine the above two part into a single number, like `1020102`.
 *
 * NOTES:
 * - In order to help keep the "SAME ordering" of "Version Code" as "Version #",
 *      all of the following should be between `1` and `99` (up to 2 digits):
 *  - Miner Number of Version
 *  - Patch Number of Version
 *  - Build Number
 *
 * @param {String} versionString
 * @param {String} buildNumberString
 */
exports.generateVersionCode = function(versionString, buildNumberString) {
    const version = new SemVer.SemVer(versionString);

    // Check if the version parts meet the requirements.
    if (version.minor > 99) {
        return {
            error: true,
            errorMessage: 'The "Miner #" of the version could not exceed "99"! Consider bumping the "Major #"?',
            versionCode: undefined
        }
    }

    if (version.patch > 99) {
        return {
            error: true,
            errorMessage: 'The "Patch #" of the version could not exceed "99"! Consider bumping the "Miner #"?',
            versionCode: undefined
        }
    }

    if (+buildNumberString > 99) {
        return {
            error: true,
            errorMessage: 'The "Build #" could not exceed "99"! Consider bumping the "Version #"?',
            versionCode: undefined
        }
    }

    // Build the "version code"
    const versionCodeString = parseInt(
        [...versionString.split('.'), ...buildNumberString]
        .map((part) => part.padStart(2, '0'))
        .join('')
    ).toString();

    return {
        error: false,
        errorMessage: undefined,
        versionCode: versionCodeString
    }
}

