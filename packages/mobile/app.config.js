// Dynamic Expo config.
// Reads the static app.json then attaches Firebase service files
// (google-services.json / GoogleService-Info.plist) only when they exist.
// This lets `expo prebuild` succeed before the user has finished
// the Firebase setup described in docs/PUSH_SETUP.md.

const fs = require('fs');
const path = require('path');
const base = require('./app.json').expo;

const here = __dirname;
const androidGsj = path.join(here, 'google-services.json');
const iosGspl = path.join(here, 'GoogleService-Info.plist');

const android = { ...(base.android || {}) };
if (fs.existsSync(androidGsj)) {
  android.googleServicesFile = './google-services.json';
}

const ios = { ...(base.ios || {}) };
if (fs.existsSync(iosGspl)) {
  ios.googleServicesFile = './GoogleService-Info.plist';
}

module.exports = {
  expo: {
    ...base,
    android,
    ios,
  },
};
