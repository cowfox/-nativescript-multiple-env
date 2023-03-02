
# nativescript-multiple-environments-building

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

[npm-image]:http://img.shields.io/npm/v/nativescript-multiple-environments-building.svg
[npm-url]:https://www.npmjs.com/package/nativescript-multiple-environments-building
[downloads-image]:http://img.shields.io/npm/dm/nativescript-multiple-environments-building.svg

This Hook aims to provide a better support for building a [NativeScript](https://nativescript.org/) application with multiple environments, such as:

- Easily use different `App Bundle ID` in different environments.
- Quickly apply the `Version #` from `package.json` to the actual destinations (`Info.plist` on `iOS` and `AndroidManifest.xml` on `Android`).
  - With the new `autoBuildNumber` config, you could easily auto generate a `Version Code` and use it when in the **RELEASE** mode.
- Safely configure the **File Copying** strategies to any type of file under different environments, like:
  - Using diff. `Info.plist` or `strings.xml` to set diff. **App Name** or other configs.
  - Having dif. `GoogleService-Info.plist` for Google services.
- Simply generate dedicated **App Icon** image for each environment.

> Credits to [federicorp](https://github.com/federicorp), the original creator of this amazing idea (via [@nativescript-dev/multiple-environments](https://github.com/federicorp/nativescript-dev-multiple-env)), as well as [jitendraP-ashutec](https://github.com/jitendraP-ashutec) who helped add the support to separate env. rule files for `iOS` and `Android` (via [@nativescript-dev/multiple-environments](https://github.com/jitendraP-ashutec/nativescript-dev-multiple-env)).

## Installation

```bash
npm i nativescript-multiple-environments-building --save-dev
```

## How to use?

Add two **Env Rules** files into the project's root folder, and they will contain the configurations for `iOS` and `Android` separately.

- `environment-rules.ios.json` - for `iOS`.
- `environment-rules.android.json` - for `Android`.

An example **Env Rules** file looks like this:

```json
{
    "version": "1.6.6",
    "buildNumber": "66",
    "versionCode": "1060666",
    "autoVersionCode": true,
    "default": "staging",
    "extraPaths": [
        "environments"
    ],
    "directCopyRules": {
        "Info.plist": "App_Resources/iOS/Info.plist",
    },
    "appIconPath": "environments/app-icon/icon.png",
    "envFilesMatchRules": "staging|release",
    "environments": [
        {
            "name": "staging",
            "appBundleId": "org.nativescript.appId.staging",
            "matchRules": "(.*\\.staging\\..*)"
        },
        {
            "name": "release",
            "appBundleId": "org.nativescript.appId.release",
            "matchRules": "(.*\\.release\\..*)"
        }
    ]
}
```

With it, using `--env.use.ENV_NAME` to specify the actual environment to process while **{NS}** doing the `prepare` process. For example:

```bash
# Debug iOS app with `staging` env. configs.
ns debug ios --env.use.staging

# Build a final release
ns run ios --bundle --env.aot --env.uglify --env.use.release
```

## Environment rules

The **Env Rules** file currently support the following configurations:

- `default` - The default `Env. Name` to use if the `cmd` does not include `--env.use.ENV_NAME`.
- `extraPaths` - The additional paths to check the `env.` files and do the file copy if needed. For example, adding `environments` will help choose right `environment.ts` for `Angular` to use.
  - By default, it checks the `App_Resources` folder. And the `extraPaths` will help cover other places.
  - The paths in `extraPaths` are relative to the `project root folder`.
- `environments` - It defines for each environment, including:
  - `name` - The `Env. Name`, used by `--env.use.ENV_NAME`.
  - `appBundleId` - The target **App Bundle ID**.
  - `matchRules` - The matching rule to help find the `source env. file` and do the file copy.
    - For example, `(.*\\.staging\\..*)` will help locate the file `Info.staging.plist`.
- `directCopyRules` - The **direct copying rules** conducted **AFTER** the normal file copy. Typically, it is used to help prepare the files on `iOS`.
  - Each `pair` includes two parts: the `source filename` and the `destination path` (relative to the `project root folder`).
  - For example: `{ "Info.plist":"App_Resources/iOS/Info.plist" }` means to copy the `Info.plist` to the `App_Resources` folder once it gets copied from its `env.` version (like `Info.dev.plist`).
  - **NOTE**: The **direct file copying** ONLY happens after done a **normal file copy**. In other words, if the `source filename` is not for a output file of a **normal file copy**, it will be ignored.
- `appIconPath` - The `file path` used for `ns resources generate icons` CMD. This is very useful when the app has diff. **App Icon** under diff. environments on `IOS`.
  - Still, the `path` is relative to the `project root folder`.
  - **NOTE**: On `Android`, the diff. **App Icon** under diff. environments could be still inside the `App_Resources` folder which could be safely deleted **AFTER** the `prepare` process.
- `envFilesMatchRules` - The specific `matching rules` to help identify all the `env.` files that could be deleted **AFTER** a `prepare`.
  - For example, if the `matchRules` use the words (`dev` and `release`) to help identify the `env` files, the value of `envFilesMatchRules` should be `dev|release`.
  - **NOTE**: This should be an `Android` ONLY config. On `iOS`, it more relies on `directCopyRules` config to help achieve the goals.
  - If not set, it will use the default value - `development|dev|edge|test|uat|beta|staging|sta|release|prod|production`.
- `version` - The version #, same as the one in the `package.json`.
- `buildNumber` - The build # that changes each time when building the app.
- `versionCode` - The version code that is used to fill `CFBundleVersion` (on `iOS`) or `VersionCode` (on `Android`).
- `autoVersionCode` - The flag to indicate if using the built-in logic to auto generate `Version Code` based on `Version #` and `Build #`.

## Discussions

### Usage of `directCopyRules`

Given the case that the `ns prepare` process will add all files inside the `App_Resources/iOS` folder into the Xcode project which will include all `env. files` for other environments, the rules inside `directCopyRules` will help conduct the file copy **OUTSIDE** the `App_Resources/iOS` folder.

And for `Android`, since it still can be safe to delete those `env. files` **AFTER** the `ns prepare` process, the **deletion** process is just simply added to the `after-prepare` Hook.

In other words, `directCopyRules` would be probably used on `iOS` side unless you are still having some other needs for `Android`.

### App Icon Generation

The generation of **App Icon** is conducted by the built-in **{NS}** CMD - `ns resources generate icons`.

By default, if the `icon.png` file is inside the `App_Resources` folder for both `iOS` and `Android`, the process can help prepare the **App Icon** files for both `iOS` and `Android`. However, the **NEW** `Android` OS versions are actually NOT using `icon.png` to be the App Icon. Instead, it uses a `mipmap` style (by an `xml` file to define both `foreground` and `background`). Luckily, the new method could be still under the realm of `env. based file copying`.

Example of `ic_launcher.xml` file:

```xml
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>

```

> **NOTE**: In order to make the `ns resources generate icons` CMD working, please be sure to **NOT** delete the default `icon.png` files from `App_Resources` folder. Otherwise, the generation process may fail!!!

### App Versioning

With the new added related **Version Info** of the **Env Rules** file, now you could manage the **App Version** in the following ways:

- The `Manual` way - Enter a free value to those fields into the **Env Rules** file every time **BEFORE** the app building.
  - In this way, set the flag `autoVersionCode` to `false` and totally ignore `buildNumber`.
- The `Auto` way - By setting `autoVersionCode` to `true`, before the app building, it will **automatically** generate a new `Version Code` based on the given values of `Version #` and `Build #`.
  - For example, a version # (`1.16.6`) and build # (`22`) will generate a new `Version Code` as `1160622`.

For `buildNumber`,

- It is a number between `0` and `99`.
- When the app gets building, if the `Version #` does not change, it will be added by `1` automatically.
  - If changed, it will be reset to `1` from the start - meaning "the **FIRST** build of the new version".

> **NOTES**:
>
> - In order to make the `Version Code` generation process works, the `miner`, `patch` parts of `Version #` and `Build #` should not exceed `99`. This limitation should cover most of the cases - typically you may have already bumped the upper part of the version number.
> - The whole updating logic of `Build #` and `Version Code` is ONLY used in the **RELEASE** mode!! With it, it will not bring too much hassle while in the **Dev** mode.
> - With the "NEW" Android building structure, the "version info" could be added to the `gradle` file. In other words, we could simply update them **BEFORE** the `prepare` process.

```
// Example of adding "version info" to `gradle` file
android {
  defaultConfig {
    // Version Information
    versionCode 1060606
    versionName "1.6.6"
  }
}
```

Also, the `iOS` and `Android` manage their **Version Info** separately. In the normal case, if you build the app against both platforms at the same time, the generated `Version Code` (as well as the `buildNumber`) should be identical for each release. However, if it does not (due to some unexpected reasons), it should be very easy to fix it by **Manually** change it to a correct value inside the **Env Rules** file.

<hr>
<h3 align="center">Made with ❤️ for the NativeScript community</h3>
