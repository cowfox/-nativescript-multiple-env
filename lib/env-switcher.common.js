'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

function create_environment(versionName) {
    return {
        name: versionName,
        packageId: `org.nativescript.appName.${versionName}`,
        copyRules: `(.*\\.${versionName}\\..*)`
    };
}

class EnvSwitcherCommon {
    constructor(logger, platformData, projectData, environmentName) {
        this.logger = logger;
        this.environmentName = environmentName;
        this.logger.info(`-o[NeoEnv]o--> Using env: ${this.environmentName}`);

        this.platformData = platformData;
        this.projectData = projectData;
        this.projectDir = this.projectData.projectDir;
        this.platformFolder = path.join(this.projectData.platformsDir, this.platformData.platformNameLowerCase);
        this.appResourcesFolder = path.join(this.projectData.appResourcesDirectoryPath, this.platformData.normalizedPlatformName);

        this.rules = this.readRules();
        this.directCopyRules = this.rules.directCopyRules || {};
    }

    // #region -> Rules <-
    // ----------
    getProjectRulesFile() {
        const fileName = 'environment-rules.' + this.platformData.platformNameLowerCase + '.json';
        const projectRules = path.join(this.projectData.projectDir, fileName);
        if (fs.existsSync(projectRules)) {
            return projectRules;
        } else {
            // Default file - 'environment-rules.json'
            return path.join(this.projectData.projectDir, 'environment-rules.json');
        }
    }

    readRules() {
        const ruleFile = this.getProjectRulesFile();
        if (fs.existsSync(ruleFile)) {
            this.logger.debug('-o[NeoEnv]o--> Environment Rules found, reading contents');
            return JSON.parse(fs.readFileSync(ruleFile).toString());
        }
        else {
            this.logger.info('-o[NeoEnv]o--x "Environment Rules" file does not exist, creating a default one');
            const environmentRules = {
                'default': 'staging',
                'extraPaths': [
                    'environments'
                ],
                'environments': [
                    create_environment('staging'),
                    create_environment('release')
                ]
            };
            fs.writeFileSync(ruleFile, JSON.stringify(environmentRules, null, 4));
            return environmentRules;
        }
    }

    // ----------
    // #endregion

    // ///////////////////////////

    // #region -> Env. <-
    // ----------

    get currentEnvironment() {
        let foundRules = this.rules.environments.find(envs => envs.name === this.environmentName);
        if (foundRules) {
            return foundRules;
        }
        else {
            this.logger.fatal('-o[NeoEnv]o--x Unable to find Rules for Environment: ' + this.environmentName);
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
                    this.logger.fatal(`-o[NeoEnv]o--x Unable to find "Gradle" file to replace, @ ${gradleFile}`);
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
        this.rules.extraPaths.forEach((filePath) => {
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
            this.logger.fatal(`-o[NeoEnv]o--x Source file "${sourcePath}" does not exist!`);
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
        const appIconPath = this.rules.appIconPath;
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
                this.logger.fatal(`-o[NeoEnv]o--x Error in generating app icon: ${error}`);
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

        // Copy Env. files
        this.copyAppResources();
        this.copyExtraFolders();

        // Generate App Icons
        this.generateAppIcon();
    }

    // ----------
    // #endregion

    // ///////////////////////////
}

exports.EnvSwitcherCommon = EnvSwitcherCommon;

