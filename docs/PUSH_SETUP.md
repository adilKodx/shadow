# Push Notifications Setup (Firebase FCM + APNs)

This is the one-time setup needed to make Phase 3 push notifications work end-to-end.
Your code is already wired; you just need to drop in **3 credential files / values**.

---

## A. Firebase project (5 min)

1. Go to https://console.firebase.google.com → **Add project** → name it `shadowfield` (or use an existing one).
2. **Add Android app**:
   - Package name: `com.shadowfield.app`
   - Download `google-services.json` → place it at `packages/mobile/google-services.json`
3. **Add iOS app**:
   - Bundle ID: `com.shadowfield.app`
   - Download `GoogleService-Info.plist` → place it at `packages/mobile/GoogleService-Info.plist`

   > Both files are auto-detected by `packages/mobile/app.config.js` — no manual
   > `app.json` edits needed. If the files are absent, prebuild still works
   > (Firebase will simply not be wired in until the files are dropped in).
4. **Enable Cloud Messaging**:
   - Project settings → **Cloud Messaging** tab
   - Make sure the Cloud Messaging API (V1) is enabled (toggle "Enable" if it shows "Disabled")

---

## B. APNs key for iOS (5 min — only once per Apple Developer team)

1. https://developer.apple.com/account → **Certificates, IDs & Profiles** → **Keys**
2. Click **+** → name it `ShadowField Push` → check **Apple Push Notifications service (APNs)** → Continue → Register
3. Download the `.p8` file (you can only download it ONCE — keep it safe)
4. Note down:
   - **Key ID** (10-character string visible on the key page)
   - **Team ID** (top-right of developer portal, 10-character string)

---

## C. Firebase service account for the Edge Function (2 min)

1. Firebase console → ⚙️ **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → confirms → downloads a `.json` file
3. **Open it in a text editor** and copy the entire JSON contents

---

## D. Configure Supabase secrets (one-liner per secret)

From the project root:

```bash
# Firebase service account JSON (whole file as one string)
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat ~/Downloads/your-firebase-adminsdk-XXXXX.json)"

# APNs auth key (.p8 file content as a string, including BEGIN/END lines)
supabase secrets set APNS_AUTH_KEY="$(cat ~/Downloads/AuthKey_XXXXXXXX.p8)"
supabase secrets set APNS_KEY_ID="ABCDE12345"      # 10-char Key ID from Apple
supabase secrets set APNS_TEAM_ID="ABCD1234EF"     # 10-char Team ID
supabase secrets set APNS_BUNDLE_ID="com.shadowfield.app"

# For TestFlight / development builds, use the APNs sandbox.
# For production / App Store builds, set this to "false" (or omit entirely).
supabase secrets set APNS_USE_SANDBOX="true"
```

---

## E. Configure DB-level GUCs so the trigger can call the Edge Function

Run once in the SQL editor (or via psql):

```sql
-- Replace <project-ref> and the JWT with your real values
alter database postgres set "app.settings.edge_url" =
  'https://<project-ref>.supabase.co/functions/v1';
alter database postgres set "app.settings.service_role_key" =
  '<paste your service_role JWT here>';
```

Both come from **Project Settings → API** in your Supabase dashboard.

---

## F. Deploy the Edge Function

```bash
cd /path/to/shadowfield
supabase functions deploy send-push --no-verify-jwt
```

(`--no-verify-jwt` is fine because we authenticate with the service-role key
that the trigger sends in the `Authorization` header.)

---

## G. Apply migration `00018_push_notifications.sql`

```bash
supabase db push
```

This creates:
- `device_tokens` table (RLS: user can only manage their own; admins see tenant-wide)
- `notification_preferences` table (RLS: user-only)
- `notify_new_incident()` trigger that calls `send-push` after insert on `incidents`
- `set_updated_at()` helper

---

## H. Mobile rebuild

Native code now references `google-services.json` and `GoogleService-Info.plist`,
so a JS reload is **not** enough — you must rebuild:

```bash
cd packages/mobile
npx expo prebuild --clean       # regenerates ios/ and android/ folders with Firebase
npx expo run:android --device   # or --simulator
npx expo run:ios --device       # or --simulator (note: simulator can't receive APNs)
```

> **iOS note**: the iOS Simulator does NOT receive remote pushes — you must use a
> physical device. APNs sandbox tokens only work with `APNS_USE_SANDBOX=true`.

---

## I. End-to-end test

1. Sign in on a phone → grant notification permission → Settings → Notifications
2. Verify it says "Permission: granted" and platform shows correctly
3. Tap **Send a local test notification** → banner should appear
4. From the web `/map`, report an incident
5. Phone should receive the push within a few seconds, even if backgrounded
6. Tap the notification → app opens directly to Live Map focused on the incident pin

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "FIREBASE_SERVICE_ACCOUNT missing" in Edge logs | `supabase secrets list` to verify, then re-set |
| FCM 401 / "INVALID_ARGUMENT" | Service account JSON has wrong project; download a fresh one |
| APNs 403 / "InvalidProviderToken" | Key ID or Team ID wrong, or .p8 file truncated |
| APNs 400 / "BadDeviceToken" | `APNS_USE_SANDBOX` mismatch with your build (dev = sandbox=true) |
| No push on iOS at all | Capabilities → Push Notifications must be enabled in Xcode (Expo handles this if `googleServicesFile` is set in `app.json`) |
| Push lands but tap doesn't open the incident | Check console for `[App] push tap → LiveMap incident <id>` — if missing, your data payload doesn't include `incident_id` |

---

## Architecture summary

```
Incident inserted in Supabase
         │
         ▼
Postgres trigger trg_incidents_notify
         │  pg_net.http_post  (service-role JWT)
         ▼
Edge Function /send-push
         │
         ├─► Looks up device_tokens for tenant
         ├─► Filters by notification_preferences
         ├─► Splits FCM (Android) vs APNs (iOS)
         │
         ├─► FCM v1 API  (signed JWT → OAuth token)
         └─► APNs HTTP/2 (signed JWT)
                  │
                  ▼
            Phone receives push
                  │  user taps
                  ▼
            App.tsx navigationRef → LiveMap
            (focusIncidentId param flies camera + opens popup)
```
