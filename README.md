
# @nativescript/multiple-environments-building

This Hook aims to provide a better support for building a [NativeScript](https://nativescript.org/) application with multiple environments, such as:

- Easily use different `App Bundle ID` in different environments.
- Quickly apply the `Version #` from `package.json` to the actual destinations (`Info.plist` on `iOS` and `AndroidManifest.xml` on `Android`).
- Safely configure the **Copying** strategies to any type of files under different environments, like:
  - Using diff. `Info.plist` or `strings.xml` to set diff. **App Name** or other configs.
  - Having dif. `GoogleService-Info.plist` for Google services.
- Simply generate dedicated **App Icon** image for each environment.

> Credits to [federicorp](https://github.com/federicorp), the original creator of this amazing idea (via [@nativescript-dev/multiple-environments](https://github.com/federicorp/nativescript-dev-multiple-env)), as well as [jitendraP-ashutec](https://github.com/jitendraP-ashutec) who helped add the support to separate env. rule files for `iOS` and `Android` (via [@nativescript-dev/multiple-environments](https://github.com/jitendraP-ashutec/nativescript-dev-multiple-env)).

## Installation

```bash
ns plugin add @nativescript/multiple-environments-building
```

## How to use?

Add two **Env Rules** files into the project's root folder, and they will contain the configurations for `iOS` and `Android` separately.

- `environment-rules.ios.json` - for `iOS`.
- `environment-rules.android.json` - for `Android`.

An example **Env Rules** file looks like this:

```json
{
    "default": "staging",
    "extraPaths": [
        "environments"
    ],
    "directCopyRules": {
        "Info.plist":"App_Resources/iOS/Info.plist",
    },
    "appIconPath": "environments/app-icon/icon.png",
    "environments": [
        {
            "name": "staging",
            "appBundleId": "org.nativescript.appId.staging",
            "matchRules": "(.*\\.staging\\..*)"
        },
        {
            "name": "release",
            "appBundleId": "org.nativescript.appName.release",
            "matchRules": "(.*\\.release\\..*)"
        }
    ]
}
```

With it, using `--env.use.ENV_NAME` to specify the actual environment to process while **{NS}** doing the `prepare` process. For example:

```bash
# Debug
ns debug ios --env.use.staging
# Build a release
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
- `appIconPath` - The `file path` used for `ns resources generate icons` CMD. This is very useful when the app has diff. **App Icon** under diff. environments.
  - Still, the `path` is relative to the `project root folder`).

## Discussions

### Usage of `directCopyRules`

Given the case that the `ns prepare` process will add all files inside the `App_Resources/iOS` folder into the Xcode project which will include all `env. files` for other environments, the rules inside `directCopyRules` will help conduct the file copy **OUTSIDE** the `App_Resources/iOS` folder.

And for `Android`, since it still can be safe to delete those `env. files` **AFTER** the `ns prepare` process, the **deletion** process is just simply added to the `after-prepare` Hook.

In other words, `directCopyRules` would be probably used on `iOS` side unless you are still having some other needs for `Android`.

<hr>
<h3 align="center">Made with ❤️ for the NativeScript community</h3>
