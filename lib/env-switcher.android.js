"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const env_switcher_common_1 = require("./env-switcher.common");

class EnvSwitcherAndroid extends env_switcher_common_1.EnvSwitcherCommon {
    constructor(logger, platformData, projectData, environmentName, androidResourcesMigrationService) {
        super(logger, platformData, projectData, environmentName);

        // Check if need to get an updated "app resource" folder - if it has done the `migration`, use new path.
        this.androidResourcesMigrationService = androidResourcesMigrationService;
        if (androidResourcesMigrationService.hasMigrated(projectData.appResourcesDirectoryPath)) {
            this.appResourcesFolder = path_1.join(this.appResourcesFolder, "src", "main", "res");
        }

    }
    copyAppResources() {
        this.detectAndCopyEnvFiles(this.appResourcesFolder);
    }
}

exports.EnvSwitcherAndroid = EnvSwitcherAndroid;
