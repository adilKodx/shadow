// Whitelabel brand config — single source of truth for tenant-specific strings.
//
// To rebrand for a new tenant, change the values in `BRAND` and rebuild.
// User-facing copy in screens MUST reference these constants instead of
// hard-coding the brand name.
//
// Note: This file controls the JS layer only. To rename the native app
// (icon, splash, package/bundle id, scheme) update `app.json` and run
// `npx expo prebuild --clean` followed by a native rebuild.

export const BRAND = {
  /** Title-cased product name shown in headers, loading screen, drawer footer. */
  appName: 'Shepherdly',
  /** Uppercased product name for tactical wordmark / login title. */
  appNameUpper: 'SHEPHERDLY',
  /** Short tagline shown under the app name on the loading splash. */
  loadingTagline: 'Security & Communication Platform',
  /** Tagline shown under the wordmark on the login screen. */
  loginTagline: 'TACTICAL OPERATIONS PLATFORM',
  /** CTA label on the login form. */
  loginButtonLabel: 'ENTER SHEPHERDLY →',
  /** Placeholder shown in the email input on login. */
  loginEmailPlaceholder: 'you@shepherdly.io',
  /** Title of the foreground-service notification while tracking location. */
  bgLocationNotificationTitle: 'Shepherdly is tracking your location',
  /** Body copy for the same foreground-service notification. */
  bgLocationNotificationBody: 'Sharing your position with the security team.',
  /** Footer line in the side drawer. Numbers come from app.json + EAS build. */
  version: '1.0.0',
  buildNumber: '247',
} as const;

/** Convenience helper — drawer footer line. */
export function brandFooter(): string {
  return `${BRAND.appNameUpper} · v${BRAND.version} · BUILD ${BRAND.buildNumber}`;
}
