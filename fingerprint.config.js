/**
 * Makes the fingerprint identical wherever it's computed — `eas update`
 * (update.yml, runs on the plain repo) and EAS Build (release.yml, where
 * `expo prebuild` runs BEFORE fingerprinting, generating an `android/` dir
 * that doesn't exist locally and rewriting package.json's android/ios
 * scripts to `expo run:*`).
 *
 * Without this, the two fingerprints diverge (the "Runtime version
 * mismatch" error): EAS's fingerprint gains a `bareNativeDir` source for
 * `android/` and a changed `packageJson:scripts` source, so updates
 * published from update.yml never match the APK's runtime version.
 *
 * How each divergence is closed:
 *
 * 1. `android/` + `ios/` — both sides ignore the native dirs explicitly.
 *    This is safe because the fingerprint already captures everything that
 *    determines the native output: app config (config plugins included),
 *    package.json deps/versions, lockfile and autolinking. The library
 *    itself ignores these dirs for managed projects; pinning it here just
 *    makes it unconditional so prebuild's timing can't change the result.
 *
 * 2. `package.json scripts` — `PackageJsonScriptsAll` drops the whole
 *    scripts section from the hash. The library's own skip
 *    (`PackageJsonAndroidAndIosScriptsIfNotContainRun`, the default) only
 *    normalizes android/ios scripts, but prebuild also injects a
 *    `postinstall` script on EAS, which that skip does NOT cover — dropping
 *    all scripts is the only reliable way to match.
 *
 * The flags are numeric (bitwise-OR'd) to match the SourceSkips enum in the
 * installed @expo/fingerprint (v0.20.x):
 *   ExpoConfigVersions = 1, PackageJsonScriptsAll = 1024.
 *
 * @type {import('@expo/fingerprint').Config}
 */
const config = {
  ignorePaths: ['android/**/*', 'ios/**/*'],
  // 1 = ExpoConfigVersions (version / android.versionCode / ios.buildNumber)
  //     so version-sync commits don't invalidate OTA; 1024 =
  //     PackageJsonScriptsAll (see above). NOTE: 256 would be ExpoConfigAll
  //     — it skips the ENTIRE app config and must not be used here.
  sourceSkips: 1 | 1024,
};

module.exports = config;
