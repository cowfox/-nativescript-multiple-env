"use strict";

var path = require("path");
var fs = require("fs");
const childProcess = require('child_process');

const versioningUtils = require('./versioning');
const fileUtils = require('./file');

// #region -> Step 1 - App Bundle ID <-
// ----------

/**
 * Update App Bundle ID if needed.
 *
 * It reads the `App Bundle ID` from the `env. rules` file and update to the app resource files if need.
 *
 */
exports.updateAppBundleId = function(logger, appBundleId, projectData, platformData, appResourcesFolder) {
    logger.info(`-o[NeoEnv]o--> Updating App Bundle ID to: "${appBundleId}"`);

    /*
        Tweak: Overwrite the value in the object `projectData.projectIdentifiers`
            so that {NS} will use the new "App Bundle ID" in the prepare process.
        NOTES:
        - The original value is from `nativescript.config.ts`.
     */
    projectData.projectIdentifiers.ios = projectData.projectIdentifiers.android = appBundleId;

    // No need to update `app.gradle` here.
    // By using the above "tweak", there is no need to add `applicationId` into `app.gradle` anymore.
    // if (platformData.platformNameLowerCase === 'android') {
    //     const gradleFile = path.resolve(appResourcesFolder, 'app.gradle');
    //     //
    //     fileUtils.replaceContentInFile(logger,
    //         /applicationId = '([A-Za-z]{1}[A-Za-z\d_]*\.)*[A-Za-z][A-Za-z\d_]*'/,
    //         `applicationId = '${appBundleId}'`,
    //         gradleFile);
    // }
}

// ----------
// #endregion

// ///////////////////////////

// #region -> Step 2 - Versioning <-
// ----------

/**
 * Update "versioning" if needed.
 *
 * The "versioning" includes 2 parts:
 * - Basic Version # - It shows as public version # of the app.
 * - Build # - It changes very time when the app gets a build. It aims to help track each build.
 *
 * The "update process" uses the `version` of the `package.json` as a base.
 * - If the `version` from the `env. rules` file is the same as the one from the `package.json`, just update the
 *  `build #` by adding `1`.
 * - If not, update the `version` from the `package.json` and set the `build #` to `1` (from a new start).
 *
 * NOTES:
 * - It only needs to update the version info in the "Release" mode.
 *
 */
exports.updateVersioning = function(logger, inReleaseMode, envRulesContent, projectData) {
    //
    const packageJsonFile = path.join(projectData.projectDir, 'package.json');
    if (!fs.existsSync(packageJsonFile)) {
        throw new Error(`-o[NeoEnv]o--x Could not locate the "package.json" file under the path: ${packageJsonFile}`);
    }
    const versionFromPackageJson = JSON.parse(fs.readFileSync(packageJsonFile)).version;

    /*
        Check if there is any issue about "version info".
        - If the related "version info" are available.
        - If the "version #" inside the "env rules" file is "beyond" the one from the `package.json` file.
     */
    if (!envRulesContent.version || !envRulesContent.buildNumber || !envRulesContent.versionCode) {
        // $logger.error(`-o[NeoEnv]o--x Could not find related "Version Info" from the "Env Rules" file!!!`);
        throw new Error(`-o[NeoEnv]o--x Could not find related "Version Info" from the "Env Rules" file!!! Please make sure the following info are available: "version", "buildNumber", "versionCode"!`);
    }

    if (versioningUtils.versionBumped(envRulesContent.version, versionFromPackageJson)) {
        throw new Error(`-o[NeoEnv]o--x Seems that the previous building version # ("${envRulesContent.version}") is beyond the version # from "package.json" ("${versionFromPackageJson}"). Please double check!!"`);
    }

    // Compare
    if (versioningUtils.versionBumped(versionFromPackageJson, envRulesContent.version)) {
        // Version updated
        envRulesContent.version = versionFromPackageJson;
        // Set the "build number" to `1` no matt if it is in the "Release" mode
        envRulesContent.buildNumber = '1';
        logger.info(`-o[NeoEnv]o--> Update new version # to "${envRulesContent.version}", and reset build # to "${envRulesContent.buildNumber}"`);
    } else {
        // Check if need to update "build #" on the same "version #"
        if (inReleaseMode) {
            // Update the build number.
            envRulesContent.buildNumber = (+envRulesContent.buildNumber + 1).toString();
            logger.info(`-o[NeoEnv]o--> Keep the version # at "${envRulesContent.version}", and update the build # to "${envRulesContent.buildNumber}"`);
        } else {
            logger.info(`-o[NeoEnv]o--> Keep the version # at "${envRulesContent.version}"`);
        }
    }

    // Check if need to generate "version code"
    const autoVersionCode = envRulesContent.autoVersionCode === true;
    if (!inReleaseMode) {
        if (autoVersionCode) {
            logger.info(`-o[NeoEnv]o--! Not in "Release" mode, skip generating the "Version Code".`);
        }

        // No need, just return the updated contents.
        return envRulesContent;
    }
    if (autoVersionCode) {
        logger.info(`-o[NeoEnv]o--> Start to auto generating a "version code" based on "version #" and "build #"...`);

        const newVersionCodeReturning = versioningUtils.generateVersionCode(envRulesContent.version, envRulesContent.buildNumber);
        //
        if (newVersionCodeReturning.error) {
            // ERROR
            throw new Error(`-o[NeoEnv]o--x Could not generate new "Version Code": ${newVersionCodeReturning.errorMessage}`);
        } else {
            const versionCode = newVersionCodeReturning.versionCode;
            envRulesContent.versionCode = versionCode;
        }

        logger.info(`-o[NeoEnv]o--> Generated a new version code "${envRulesContent.versionCode}" based on the version # ("${envRulesContent.version}") and build # ("${envRulesContent.buildNumber}")`);
    }

    //
    return envRulesContent
}

/**
 * Save "Version Info" to the `Gradle` file if needed.
 *
 * NOTES:
 * - In the newer {NS} building, `Android` adds the "version info" to the `Gradle` file
 *      instead of the old `AndroidManifest.xml` file.
 * - In other words, we are going to set the new "version info" BEFORE the "prepare" process.
 *
 */
exports.saveVersioningToAndroidGradle = function(logger, appResourcesFolder, envRulesContent) {
    const gradleFile = path.resolve(appResourcesFolder, 'app.gradle');

    // Version #
    fileUtils.replaceContentInFile(logger,
        /(versionName)[\s\d."]+"/,
        `versionName "${envRulesContent.version}"`,
        gradleFile);

    // Version Code
    fileUtils.replaceContentInFile(logger,
        /(versionCode)[\s]+[\d.]+/,
        `versionCode ${envRulesContent.versionCode}`,
        gradleFile);
}

// ----------
// #endregion

// ///////////////////////////

// #region -> Step 3 - File Copy <-
// ----------

exports.copyAppResources = function(logger, appResourcesFolder, matchRulesString, directCopyRules, projectData) {
    fileUtils.detectAndCopyEnvFiles(logger, appResourcesFolder, matchRulesString, directCopyRules, projectData);
}

/**
 * Check and copy files outside the "App_Resources" folder. This is
 *
 * NOTES:
 * - For these "extra" folders, firstly check if they are "full paths" or not.
 *
 */
exports.copyExtraFolders = function(logger, extraPaths, matchRulesString, directCopyRules, projectData) {
    extraPaths.forEach((folderPath) => {
        // Convert it to a "full path" if needed.
        const folderFullPath = folderPath.indexOf(projectData.$projectHelper.cachedProjectDir) < 0 ?
            path.join(projectData.$projectHelper.cachedProjectDir, folderPath) : folderPath;

        // Check and copy
        fileUtils.detectAndCopyEnvFiles(logger, folderFullPath, matchRulesString, directCopyRules, projectData);
    });
}

// ----------
// #endregion

// ///////////////////////////

// #region -> Step 4 - App Icon <-
// ----------

exports.generateAppIcon = function(logger, appIconPath, projectData) {
    if (appIconPath && fs.existsSync(path.join(projectData.projectDir, appIconPath))) {
        // Get the absolute path of the app icon file, based on the `project root directory`.
        const fullAppIconPath = path.join(projectData.projectDir, appIconPath);

        // Run CMD
        logger.info(`-o[NeoEnv]o--> Found "App Icon" path at "${appIconPath}". Re-generating...`);
        const cmd = `ns resources generate icons ${fullAppIconPath}`
        try {
            childProcess.execSync(cmd, { stdio: 'ignore'})
            logger.info(`-o[NeoEnv]o--> Done generating app icon`);
        } catch (error) {
            throw new Error(`-o[NeoEnv]o--x Error in generating app icon: ${error}`);
        }
    }
}

// ----------
// #endregion

// ///////////////////////////

