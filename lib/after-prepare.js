"use strict";

var path = require("path");
var fs = require("fs");
var plist = require('plist');

const envRulesUtils = require('./utils/env-rules');
const fileUtils = require('./utils/file');

/**
 * `after-prepare` hook.
 *
 * Two tasks:
 * - Update the `version info` from the "Env Rules" file to the target files.
 * - Remove "env. based" files while making `Android` builds.
 *      - For `iOS` build, it takes another way to handle it "BEFORE" the prepare!
 *
 */
module.exports = function($logger, $projectData, hookArgs) {
    return new Promise(function(resolve, reject) {
        // Try to get the platform info
        const platformNameFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
        const platformName = (platformNameFromHookArgs  || '').toLowerCase();
        const projectName = $projectData.projectName;

        // Get "Env Rules"
        const envRulesFilePath = envRulesUtils.getEnvRulesFilePath(
            `environment-rules.${platformName}.json`,
            $projectData.projectDir);
        const envRulesContent = envRulesUtils.readEnvRules(envRulesFilePath);

        // #region -> Update Version # <-
        // ----------
        $logger.info(`-o[NeoEnv]o--> After "prepare" hook - updating "version info" on platform: "${platformName}"`);

        /*
            Try to update the `version` to diff. platform files.
         */
        const platformFolderPath = path.join($projectData.platformsDir, platformName);
        if (platformName === 'ios') {
            // iOS - update the file `info.plist`
            const projectInfoPlistPath = path.join(
                platformFolderPath,
                `${projectName}/${projectName}-Info.plist`
            );
            if (fs.existsSync(projectInfoPlistPath)) {
                let infoPlistContent = plist.parse(fs.readFileSync(projectInfoPlistPath, 'utf8'));

                infoPlistContent['CFBundleShortVersionString'] = envRulesContent.version;
                infoPlistContent['CFBundleVersion'] = envRulesContent.versionCode;

                // Write the content back
                fs.writeFileSync(projectInfoPlistPath, plist.build(infoPlistContent));
            }
        } else if (platformName === 'android') {
            /*
                Android - still try update the file `AndroidManifest.xml`

                NOTES:
                - This step is to help cover the "OLD" building method of {NS}.
                - In the "NEW" way, the "version info" should have been updated to the `Gradle` file "BEFORE" the "prepare".
             */
            const projectAndroidManifestPath = path.join(platformFolderPath, 'app/src/main/AndroidManifest.xml');

            // Version Name
            fileUtils.replaceContentInFile($logger,
                /(android:versionName=")[\d.]+(")/,
                `$1${envRulesContent.version}$2`,
                projectAndroidManifestPath);

            // Version Code
            fileUtils.replaceContentInFile($logger,
                /(android:versionCode=")[\d.]+(")/,
                `$1${envRulesContent.versionCode}$2`,
                projectAndroidManifestPath);

        }

        $logger.info(`-o[NeoEnv]o--> Updated the version "${envRulesContent.version}" with the version code "${envRulesContent.versionCode}"`);

        // ----------
        // #endregion


        // #region -> Remove "Env" Files <-
        // ----------

        /*
            Try to remove "env. based" files.

            NOTES:
            - Since on iOS, every copied file in the `prepare` process is registered within the Xcode build target,
                which means we could not simply delete them after the `prepare`.
            - Thus, we only do the deletion for `Android`.
         */
        // Delete unneeded env. related files.
        if (platformName === 'android') {
            // const deleteMatchPattern = envRulesContent.envFilesMatchRules ?
            //     `.*\.(${envRulesContent.envFilesMatchRules})\..*`
            //     : /.*\.(development|dev|edge|test|uat|beta|staging|sta|release|prod|production)\..*/;
            const deleteMatchPattern = envRulesContent.envFilesMatchRules ?
                new RegExp(`[\\w?].*\\.(${envRulesContent.envFilesMatchRules})[$|\\..*]`)
                : /[\w?].*\.(development|dev|test|uat|staging|sta|alpha|beta|release|prod|production)[$|\..*]/
            const targetFolderPath = path.join(platformFolderPath, 'app');

            $logger.info(`-o[NeoEnv]o--> Deleting unused env. files from the folder "${targetFolderPath}" with the matching rules /${deleteMatchPattern}/`);

            // Start to test & delete files from the `platform` folder
            fileUtils.detectAndDeleteEnvFiles($logger, targetFolderPath, deleteMatchPattern);
        }

        // ----------
        // #endregion

        // Finish
        resolve();
    });
};