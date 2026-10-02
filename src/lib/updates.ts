import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * Thin wrapper around expo-updates for the self-hosted distribution flow:
 * APKs are installed manually from the website; JS-only fixes arrive over
 * EAS Update without reinstalling. Native changes require a new APK, which
 * the fingerprint runtimeVersion policy guarantees via matching runtimes.
 */

export function updatesSupported(): boolean {
  // Expo Go and web cannot receive OTA updates.
  return Platform.OS !== 'web' && !__DEV__;
}

export interface CheckResult {
  /** Whether a new update was downloaded and applied (reload pending). */
  applied: boolean;
  /** True when the check itself failed, so the UI can show it as an error. */
  failed: boolean;
  /** Human readable status for the UI. */
  message: string;
}

/** Steps of a check, reported while it runs so the button never looks dead. */
export type CheckPhase = 'checking' | 'downloading' | 'reloading';

/** Build info appended to failures so OTA problems are diagnosable in-app. */
function diagnostics(): string {
  const parts = [
    `runtime=${Updates.runtimeVersion ?? 'none'}`,
    `channel=${Updates.channel ?? 'none'}`,
  ];
  return parts.join(', ');
}

export async function checkForUpdate(
  onPhase?: (phase: CheckPhase) => void
): Promise<CheckResult> {
  if (!updatesSupported()) {
    return { applied: false, failed: true, message: 'Not available (dev build or web).' };
  }
  if (!Updates.isEnabled) {
    // Builds without an updates URL/channel, or with updates disabled, reject
    // every call with a cryptic native error — say what is actually wrong.
    return {
      applied: false,
      failed: true,
      message: `Updates are disabled in this build. Reinstall the latest APK from the website. [${diagnostics()}]`,
    };
  }
  try {
    onPhase?.('checking');
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      return { applied: false, failed: false, message: 'You are on the latest version.' };
    }
    onPhase?.('downloading');
    const fetched = await Updates.fetchUpdateAsync();
    // A roll back to the embedded bundle also needs a reload to take effect.
    if (!fetched.isNew && !fetched.isRollBackToEmbedded) {
      return {
        applied: false,
        failed: true,
        message: `An update was found but could not be downloaded. Try again later. [${diagnostics()}]`,
      };
    }
    onPhase?.('reloading');
    await Updates.reloadAsync();
    return { applied: true, failed: false, message: 'Updated! Reloading…' };
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.message}${error.cause instanceof Error ? ` (${error.cause.message})` : ''}`
        : 'unknown error';
    return {
      applied: false,
      failed: true,
      // The channel/runtime pair is what EAS Update validates: a mismatch
      // or a missing channel is the usual reason for "request rejected".
      message: `Update check failed: ${detail} [${diagnostics()}]`,
    };
  }
}
