var path = require("path");
var fs = require("fs");
var plist = require('plist');

/**
 * `after-prepare` hook.
 *
 * Two tasks:
 * - Update the `version #` based on the value inside the `package.json` file
 * - Remove "env. based" files while making `Android` builds.
 *      - For `iOS` build, it takes another way to handle it.
 *
 */
module.exports = function($logger, $projectData, hookArgs) {
    return new Promise(function(resolve, reject) {
        // Try to get the platform info
        const platformNameFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
        const platformName = (platformNameFromHookArgs  || '').toLowerCase();
        const projectName = $projectData.projectName;
        $logger.info('-o[NeoEnv]o--> After "prepare" hook - updating version # on platform:', platformName);

        // #region -> Update Version # <-
        // ----------
        // Get the Version # from `package.json` file
        const packageJson = path.join($projectData.projectDir, 'package.json');
        if (!fs.existsSync(packageJson)) {
            $logger.error('-o[NeoEnv]o--x Could not locate the `package.json` file under the path:', packageJson);
            reject();
        }
        const versionString = JSON.parse(fs.readFileSync(packageJson)).version;

        // Build a `version # code`.
        // - For example, version `2.3.1` will have the `number` based string - `20301`
        const versionCodeString = parseInt(
            versionString.split('.')
            .map((part) => part.padStart(2, '0'))
            .join('')
        ).toString();
        $logger.info(`-o[NeoEnv]o--> Updated the version "${versionString}" with the version code "${versionCodeString}"`);

        /*
            Try to update the `version` to diff. platform files.
         */
        const platformFolderPath = path.join($projectData.platformsDir, platformName);
        if (platformName === 'ios') {
            // iOS - change the file `info.plist`
            const projectInfoPlistPath = path.join(
                platformFolderPath,
                `${projectName}/${projectName}-Info.plist`
            );
            if (fs.existsSync(projectInfoPlistPath)) {
                let infoPlistContent = plist.parse(fs.readFileSync(projectInfoPlistPath, 'utf8'));

                infoPlistContent['CFBundleShortVersionString'] = versionString;
                infoPlistContent['CFBundleVersion'] = versionCodeString;

                // Write the content back
                fs.writeFileSync(projectInfoPlistPath, plist.build(infoPlistContent));
            }
        } else if (platformName === 'android') {
            // Android - change the file `AndroidManifest.xml`
            const projectAndroidManifestPath = path.join(platformFolderPath, 'app/src/main/AndroidManifest.xml');
            if (fs.existsSync(projectAndroidManifestPath)) {
                let androidManifestContent = fs.readFileSync(projectAndroidManifestPath).toString();

                const versionNamePattern = /(android:versionName=")[\d.]+(")/
                if (versionNamePattern.test(androidManifestContent)) {
                    androidManifestContent = androidManifestContent.replace(
                        versionNamePattern,
                        `$1${versionString}$2`
                    );
                }

                const versionCodePattern = /(android:versionCode=")[\d.]+(")/
                if (versionCodePattern.test(androidManifestContent)) {
                    androidManifestContent = androidManifestContent.replace(
                        versionCodePattern,
                        `$1${versionCodeString}$2`
                    );
                }

                // Write the content back
                fs.writeFileSync(projectAndroidManifestPath, androidManifestContent);
            }
        }

        /*
            Try to remove "env. based" files.

            NOTES:
            - Since on iOS, every copied file in the `prepare` process is registered within the Xcode build target,
                which means we could not simply delete them after the `prepare`.
            - Thus, we only do the deletion for `Android`.
         */

        // The matching pattern - it includes any `env` keyword
        const deleteTestPattern = /.*\.(development|dev|edge|test|uat|beta|staging|release)\..*/

        // The atom func to test and delete the file if matches.
        const testForFileDeletion = (parentPath, item) => {
            const itemPath = path.join(parentPath, item);
            try {
                if (fs.statSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
                    // It is a folder, loop in.
                    fs.readdirSync(itemPath).forEach((deeperItem) => testForFileDeletion(
                        path.join(parentPath,item),
                        deeperItem
                    ));
                } else {
                    if (deleteTestPattern.test(item)) {
                        $logger.info('-o[NeoEnv]o--> Delete a `env.` based file:', itemPath);
                        fs.unlinkSync(itemPath);
                    }
                }
            }
            catch (_a) { }
        };

        // Delete unneeded env. related files.
        if (platformName === 'android') {
            const targetFolderPath = path.join(platformFolderPath, 'app');
            // Start to test & delete files from the `paltform` folder
            fs.readdirSync(targetFolderPath).forEach(
                (item) => testForFileDeletion(targetFolderPath, item)
                );
        }

        // Finish
        resolve();
    });
};