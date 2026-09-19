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
  /** Human readable status for the UI. */
  message: string;
}

/** Build info appended to failures so OTA problems are diagnosable in-app. */
function diagnostics(): string {
  const parts = [
    `runtime=${Updates.runtimeVersion ?? 'none'}`,
    `channel=${Updates.channel ?? 'none'}`,
  ];
  return parts.join(', ');
}

export async function checkForUpdate(): Promise<CheckResult> {
  if (!updatesSupported()) {
    return { applied: false, message: 'Not available (dev build or web).' };
  }
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      return { applied: false, message: 'You are on the latest version.' };
    }
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return { applied: true, message: 'Updated! Reloading…' };
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.message}${error.cause instanceof Error ? ` (${error.cause.message})` : ''}`
        : 'unknown error';
    return {
      applied: false,
      // The channel/runtime pair is what EAS Update validates: a mismatch
      // or a missing channel is the usual reason for "request rejected".
      message: `Update check failed: ${detail} [${diagnostics()}]`,
    };
  }
}
