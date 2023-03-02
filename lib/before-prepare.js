"use strict";
const path = require('path');
const fs = require('fs');

const envRulesUtils = require('./utils/env-rules');
const processes = require('./utils/processes');

const DEFAULT_ENV_NAME = 'development';

module.exports = function ($logger, $platformsDataService, $projectData, hookArgs, $androidResourcesMigrationService) {
    // Get data
    const platformName = hookArgs.prepareData.platform.toLowerCase();
    const platformData = $platformsDataService.getPlatformData(platformName, $projectData);
    const appBuildingInfo = {
        release: false, // If it is in the "Release" mode
        envName: DEFAULT_ENV_NAME
    };

    // Get `env.` Info
    /*
        The format of `env.` info inside `prepareData` is like:
        ```
        {
            ...
            env: { use: { development: true }, hmr: undefined },
        }
        ```
     */
    $logger.debug('hookArgs.prepareData', hookArgs.prepareData);
    if (hookArgs && hookArgs.prepareData && hookArgs.prepareData.env && typeof hookArgs.prepareData.env === 'object') {
        // object
        appBuildingInfo.envName = hookArgs.prepareData.env.use && typeof hookArgs.prepareData.env.use === 'object' ? Object.keys(hookArgs.prepareData.env.use)[0] : DEFAULT_ENV_NAME;
    }
    if (hookArgs && hookArgs.prepareData) {
        appBuildingInfo.release = hookArgs.prepareData.release === true;
    }

    $logger.info(`-o[NeoEnv]o--> Using env: ${appBuildingInfo.envName}`);

    // Prep
    // const platformFolder = path.join($projectData.platformsDir, platformData.platformNameLowerCase);
    const appResourcesFolder = path.join($projectData.appResourcesDirectoryPath, platformData.normalizedPlatformName);

    const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
        `environment-rules.${platformData.platformNameLowerCase}.json`,
        $projectData.projectDir);
    $logger.debug(`-o[NeoEnv]o--> Target "Env Rules" file path: ${envRulesFilePath}`);
    let envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);
    // Get "direct copy rules", use `{}` if not available.
    const directCopyRules = envRulesContent.directCopyRules || {};
    const envEntry = envRulesContent.environments.find(env => env.name === appBuildingInfo.envName);
    if (!envEntry) {
        throw new Error(`-o[NeoEnv]o--x Unable to find the specific Entry for the env: ${appBuildingInfo.envName}`);
    }

    // #region -> Process <-
    // ----------

    // Step 1 - App Bundle ID
    processes.updateAppBundleId($logger, envEntry.appBundleId, $projectData, platformData, appResourcesFolder);

    // Step 2 - Versioning
    envRulesContent = processes.updateVersioning($logger, appBuildingInfo.release, envRulesContent, $projectData);
    // Check if need to update the `gradle` file on `Android`.
    if (platformData.platformNameLowerCase === 'android') {
        processes.saveVersioningToAndroidGradle($logger, appResourcesFolder, envRulesContent);
    }

    // Step 3 - File Copy
    processes.copyAppResources($logger, appResourcesFolder, envEntry.matchRules, directCopyRules, $projectData);
    processes.copyExtraFolders($logger, envRulesContent.extraPaths, envEntry.matchRules, directCopyRules, $projectData);

    // Step 4 - App Icon
    processes.generateAppIcon($logger, envRulesContent.appIconPath, $projectData);

    // Update "Env Rules" contents.
    fs.writeFileSync(envRulesFilePath, JSON.stringify(envRulesContent, null, 4));

    // ----------
    // #endregion

};
