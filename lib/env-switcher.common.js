'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

const versioningUtils = require('./utils/versioning');
const envRulesUtils = require('./utils/env-rules');

class EnvSwitcherCommon {
    constructor(logger, platformData, projectData, envInfo) {
        this.logger = logger;
        this.envInfo = envInfo;
        this.logger.info(`-o[NeoEnv]o--> Using env: ${this.envInfo.envName}`);

        this.platformData = platformData;
        this.projectData = projectData;
        this.projectDir = this.projectData.projectDir;
        this.platformFolder = path.join(this.projectData.platformsDir, this.platformData.platformNameLowerCase);
        this.appResourcesFolder = path.join(this.projectData.appResourcesDirectoryPath, this.platformData.normalizedPlatformName);

        this.envRulesFilePath = this.getEnvRulesFileFullPath();
        this.logger.debug(`-o[NeoEnv]o--> Target "Env Rules" file path: ${this.envRulesFilePath}`);
        this.envRulesContent = this.readEnvRules();
        // Get "direct copy rules", use `{}` if not available.
        this.directCopyRules = this.envRulesContent.directCopyRules || {};
    }

    // #region -> Rules <-
    // ----------
    getEnvRulesFileFullPath() {
        return envRulesUtils.getEnvRulesFilePath(
            `environment-rules.${this.platformData.platformNameLowerCase}.json`,
            this.projectData.projectDir);
    }

    readEnvRules() {
        const envRulesContent = envRulesUtils.readEnvRules(this.envRulesFilePath);
        if (!envRulesContent) {
            throw new Error('-o[NeoEnv]o--x "Environment Rules" file does not exist! Skip...');
        }

        return envRulesContent;
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Env. <-
    // ----------

    get currentEnvironment() {
        let foundRules = this.envRulesContent.environments.find(envs => envs.name === this.envInfo.envName);
        if (foundRules) {
            return foundRules;
        }
        else {
            throw new Error(`-o[NeoEnv]o--x Unable to find Rules for Environment: ${this.envInfo.envName}`);
        }
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Versioning <-
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
    updateVersioning() {
        if (!this.envInfo.release) {
            this.logger.info(`-o[NeoEnv]o--> Not in "Release" mode, skip updating the "Build #" and "Version Code".`);
        }

        //
        const packageJsonFile = path.join(this.projectData.projectDir, 'package.json');
        if (!fs.existsSync(packageJsonFile)) {
            throw new Error(`-o[NeoEnv]o--x Could not locate the "package.json" file under the path: ${packageJsonFile}`);
        }
        const versionFromPackageJson = JSON.parse(fs.readFileSync(packageJsonFile)).version;

        /*
            Check if there is any issue about "version info".
            - If the related "version info" are available.
            - If the "version #" inside the "env rules" file is "beyond" the one from the `package.json` file.
         */
        if (!this.envRulesContent.version || !this.envRulesContent.buildNumber || !this.envRulesContent.versionCode) {
            // $logger.error(`-o[NeoEnv]o--x Could not find related "Version Info" from the "Env Rules" file!!!`);
            throw new Error(`-o[NeoEnv]o--x Could not find related "Version Info" from the "Env Rules" file!!! Please make sure the following info are available: "version", "buildNumber", "versionCode"!`);
        }

        if (versioningUtils.versionBumped(this.envRulesContent.version, versionFromPackageJson)) {
            throw new Error(`-o[NeoEnv]o--x Seems that the previous building version # ("${this.envRulesContent.version}") is beyond the version # from "package.json" ("${versionFromPackageJson}"). Please double check!!"`);
        }

        // Compare
        if (versioningUtils.versionBumped(versionFromPackageJson, this.envRulesContent.version)) {
            // Version updated
            this.envRulesContent.version = versionFromPackageJson;

            // Check if need to update "build #"
            if (this.envInfo.release) {
                // Set the "build number" to `1`
                this.envRulesContent.buildNumber = '1';
                this.logger.info(`-o[NeoEnv]o--> Update new version # to "${this.envRulesContent.version}", and reset build # to "${this.envRulesContent.buildNumber}"`);
            } else {
                this.logger.info(`-o[NeoEnv]o--> Update new version # to "${this.envRulesContent.version}"`);
            }
        } else {
            // Check if need to update "build #"
            if (this.envInfo.release) {
                // Just update the build number.
                this.envRulesContent.buildNumber = (+this.envRulesContent.buildNumber + 1).toString();
                this.logger.info(`-o[NeoEnv]o--> Keep the version # at "${this.envRulesContent.version}", and update the build # to "${this.envRulesContent.buildNumber}"`);
            } else {
                this.logger.info(`-o[NeoEnv]o--> Keep the version # at "${this.envRulesContent.version}"`);
            }
        }

        // Check if need to generate "version code"
        if (!this.envInfo.release) {
            // No need to update
            return;
        }
        const autoVersionCode = this.envRulesContent.autoVersionCode === true;
        if (autoVersionCode) {
            this.logger.info(`-o[NeoEnv]o--> Start to auto generating a "version code" based on "version #" and "build #"...`);

            const newVersionCodeReturning = versioningUtils.generateVersionCode(this.envRulesContent.version, this.envRulesContent.buildNumber);
            //
            if (newVersionCodeReturning.error) {
                // ERROR
                throw new Error(`-o[NeoEnv]o--x Could not generate new "Version Code": ${newVersionCodeReturning.errorMessage}`);
            } else {
                const versionCode = newVersionCodeReturning.versionCode;
                this.envRulesContent.versionCode = versionCode;
            }

            this.logger.info(`-o[NeoEnv]o--> Generated a new version code "${this.envRulesContent.versionCode}" based on the version # ("${this.envRulesContent.version}") and build # ("${this.envRulesContent.buildNumber}")`);
        }
    }

    // ----------
    // #endregion

    // ///////////////////////////


    // #region -> App Bundle ID <-
    // ----------

    /**
     * Update App Bundle ID if needed.
     *
     * It reads the `App Bundle ID` from the `env. rules` file and update to the app resource files if need.
     *
     * NOTES:
     * - Only need to do so on `Android`.
     *
     */
    updateAppBundleId() {
        this.logger.info(`-o[NeoEnv]o--> Updating App Bundle ID to: ${this.currentEnvironment.appBundleId}`);
        this.projectData.projectIdentifiers.ios = this.projectData.projectIdentifiers.android = this.currentEnvironment.appBundleId;

        if (this.platformData.platformNameLowerCase === 'android') {
            const gradleFile = path.resolve(this.appResourcesFolder, 'app.gradle');

            try {
                if (fs.existsSync(gradleFile)) {
                    const currentGradleFile = fs.readFileSync(gradleFile).toString();
                    const oldApplicationId = /applicationId = '([A-Za-z]{1}[A-Za-z\d_]*\.)*[A-Za-z][A-Za-z\d_]*'/;
                    const newApplicationId = `applicationId = '${this.currentEnvironment.appBundleId}'`;
                    const modifiedGradleFile = currentGradleFile.replace(oldApplicationId, newApplicationId);

                    fs.writeFileSync(gradleFile, modifiedGradleFile);
                }
                else {
                    throw new Error(`-o[NeoEnv]o--x Unable to find "Gradle" file to replace, @ ${gradleFile}`);
                }
            }
            catch (e) {
                throw e;
            }
        }
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Copy Files <-
    // ----------

    // Copy files under `App_Resources` folder.
    //  - Called on the specific platform.
    copyAppResources() { }

    copyExtraFolders() {
        this.envRulesContent.extraPaths.forEach((filePath) => {
            this.detectAndCopyEnvFiles(filePath);
        });
    }

    /**
     * Check if need to make a "direct copy" of a file.
     *
     * NOTES:
     * - Usually it happens when copying a file into the `iOS` folder to
     *      avoid leaving all unneeded `env.` files into the `iOS` app builds.
     */
    doDirectFileCopy(filename, filePath) {
        if (Object.keys(this.directCopyRules).includes(filename)) {
            const destinationFilePath = path.join(this.projectDir, this.directCopyRules[filename]);
            this.logger.info(`-o[NeoEnv]o--> Direct copying a file "${filename}" to "${this.directCopyRules[filename]}"`);
            fs.writeFileSync(destinationFilePath, fs.readFileSync(filePath));
        }
    }

    detectAndCopyEnvFiles(inputFolder) {
        const matchRules = new RegExp(this.currentEnvironment.matchRules);

        // For `extraPaths` items, it is not a full path. Need to add the "base path" of the project.
        let folderFullPath = inputFolder.indexOf(this.projectData.$projectHelper.cachedProjectDir) < 0 ?
            path.join(this.projectData.$projectHelper.cachedProjectDir, inputFolder) : inputFolder;
        const dirContents = fs.readdirSync(folderFullPath);

        /**
         * Build the destination filename.
         *
         * Based on the rules, it only remove the `env.` related section.
         * For example: `en.default.staging.json` will be renamed to `en.default.json`
         *
         */
        const buildDestinationFileName = (file) => {
            let fileNameParts = file.split('.');
            let ext = fileNameParts[fileNameParts.length - 1]
            let fileName = fileNameParts.splice(0, fileNameParts.length - 2).join('.');
            return `${fileName}.${ext}`;
        };

        const testEnvFileToCopy = (parentPath, file) => {
            const filePath = path.join(parentPath, file);

            try {
                if (fs.statSync(filePath) && fs.statSync(filePath).isDirectory()) {
                    // Loop into the folder.
                    fs.readdirSync(filePath).forEach((deeperItem) => testEnvFileToCopy(filePath, deeperItem));
                }
                else {
                    this.logger.debug('-o[NeoEnv]o--- Check file:', file);
                    if (matchRules.test(file)) {
                        const destinationFileName = buildDestinationFileName(file);
                        const destinationFilePath = path.join(parentPath, destinationFileName);

                        this.logger.info(`-o[NeoEnv]o--> Copying env. file "${file}" to "${destinationFileName}"`);

                        // Check if the dest. file is the same as the source file.
                        //  - If `yes`, skip the copy.
                        if (!this.doesSourceMatchDestination(filePath, destinationFilePath)) {
                            fs.writeFileSync(destinationFilePath, fs.readFileSync(filePath));
                        }
                        else {
                            this.logger.debug('-o[NeoEnv]o--x Not writing new file, as file that exists matches the file that it will be replaced with.');
                        }

                        // Check if need to do a "direct file copy"
                        this.doDirectFileCopy(destinationFileName, destinationFilePath);
                    }
                }
            }
            catch (_error) { }
        };

        // Start to check and copy files.
        dirContents.forEach((file) => testEnvFileToCopy(folderFullPath, file));
    }

    doesSourceMatchDestination(sourcePath, destinationPath) {
        let sourceFileContents, destinationFileContents;

        if (fs.existsSync(sourcePath)) {
            sourceFileContents = fs.readFileSync(sourcePath);
        }
        else {
            throw new Error(`-o[NeoEnv]o--x Source file "${sourcePath}" does not exist!`);
        }

        if (fs.existsSync(destinationPath)) {
            destinationFileContents = fs.readFileSync(destinationPath);
        }
        else {
            this.logger.debug(`-o[NeoEnv]o--x Destination file "${destinationPath}" does not exist!`);
            return false;
        }

        return sourceFileContents === destinationFileContents;
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Generate App Icon <-
    // ----------

    generateAppIcon() {
        const appIconPath = this.envRulesContent.appIconPath;
        if (appIconPath && fs.existsSync(path.join(this.projectDir, appIconPath))) {
            // Get the absolute path of the app icon file, based on the `project root directory`.
            const fullAppIconPath = path.join(this.projectDir, appIconPath);

            // Run CMD
            this.logger.info(`-o[NeoEnv]o--> Found "App Icon" path at "${appIconPath}". Re-generating...`);
            const cmd = `ns resources generate icons ${fullAppIconPath}`
            try {
                childProcess.execSync(cmd, { stdio: 'ignore'})
                this.logger.info(`-o[NeoEnv]o--> Done generating app icon`);
            } catch (error) {
                throw new Error(`-o[NeoEnv]o--x Error in generating app icon: ${error}`);
            }
        }
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Run <-
    // ----------

    run() {
        this.updateAppBundleId();
        this.updateVersioning();

        // Copy Env. files
        this.copyAppResources();
        this.copyExtraFolders();

        // Generate App Icons
        this.generateAppIcon();

        // Update the `env rules` file
        fs.writeFileSync(this.envRulesFilePath, JSON.stringify(this.envRulesContent, null, 4));
    }

    // ----------
    // #endregion

    // ///////////////////////////
}

exports.EnvSwitcherCommon = EnvSwitcherCommon;

