/**
 * Keeps the EAS Update fingerprint stable across version bumps.
 *
 * With the `fingerprint` runtimeVersion policy, the fingerprint normally
 * hashes the whole app config — including `version`, `android.versionCode`
 * and `ios.buildNumber`. Bumping the version for a new APK release would
 * therefore change the fingerprint, and every install that received the
 * new APK would stop seeing OTA updates until the next full rebuild
 * (fingerprint mismatch between the binary and the published update).
 *
 * Version numbers don't affect the native runtime, so excluding them here
 * keeps OTA working across releases. Applied wherever the fingerprint is
 * computed: `eas update` (update.yml), EAS cloud builds (release.yml) and
 * the in-app "Check for updates" flow (which compares the device's
 * fingerprint against the runtime version of published updates).
 *
 * The flags are numeric (bitwise-OR'd) to match the SourceSkips enum in
 * @expo/fingerprint (v0.20.x): ExpoConfigVersions = 1,
 * PackageJsonAndroidAndIosScriptsIfNotContainRun = 256.
 *
 * @type {import('@expo/fingerprint').Config}
 */
const config = {
  // 1 = ExpoConfigVersions (version / android.versionCode / ios.buildNumber)
  // + 256 = PackageJsonAndroidAndIosScriptsIfNotContainRun (the CLI default;
  //         re-added so the default behavior isn't lost when overriding)
  sourceSkips: 1 | 256,
};

module.exports = config;
