"use strict";
const env_switcher_android_1 = require("./env-switcher.android");
const env_switcher_ios_1 = require("./env-switcher.ios");

const DEFAULT_ENV_NAME = 'development';

module.exports = function ($logger, $platformsDataService, $projectData, hookArgs, $androidResourcesMigrationService) {
    // Get data
    const platformName = hookArgs.prepareData.platform.toLowerCase();
    const platformData = $platformsDataService.getPlatformData(platformName, $projectData);
    const envInfo = {
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
        envInfo.envName = hookArgs.prepareData.env.use && typeof hookArgs.prepareData.env.use === 'object' ? Object.keys(hookArgs.prepareData.env.use)[0] : DEFAULT_ENV_NAME;
    }
    if (hookArgs && hookArgs.prepareData) {
        envInfo.release = hookArgs.prepareData.release === true;
    }

    // Run
    let envSwitcher;
    if (platformName === "android") {
        envSwitcher = new env_switcher_android_1.EnvSwitcherAndroid($logger, platformData, $projectData, envInfo, $androidResourcesMigrationService);
    }
    else if (platformName === "ios") {
        envSwitcher = new env_switcher_ios_1.EnvSwitcherIOS($logger, platformData, $projectData, envInfo);
    }
    else {
        $logger.warn(`-o[NeoEnv]o--! Platform '${platformName}' isn't supported: skipping environment copy... `);
        return;
    }
    envSwitcher.run();
};
