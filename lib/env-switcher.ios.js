"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_switcher_common_1 = require("./env-switcher.common");

class EnvSwitcherIOS extends env_switcher_common_1.EnvSwitcherCommon {
    copyAppResources() {
        this.detectAndCopyEnvFiles(this.appResourcesFolder);
    }
}

exports.EnvSwitcherIOS = EnvSwitcherIOS;
