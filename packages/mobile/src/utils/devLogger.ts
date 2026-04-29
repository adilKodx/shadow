/**
 * ShadowField Dev Logger
 *
 * Captures all errors, warnings, and crashes on device.
 * - Outputs structured logs to the Metro terminal
 * - Persists crash/error logs via AsyncStorage (works in Expo Go)
 *
 * Log keys in AsyncStorage:
 *   @sf_log:crash-YYYY-MM-DD  — one key per day, keeps last 7 days
 *
 * Activated only in __DEV__. Import at top of App.tsx.
 *
 * Terminal prefixes:
 *   [CRASH]   — unhandled JS errors (global)
 *   [PROMISE] — unhandled promise rejections
 *   [ERROR]   — console.error intercepts
 *   [WARN]    — console.warn intercepts
 *   [NAV]     — navigation state changes
 *   [NET]     — failed network requests (Supabase, fetch)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_PREFIX = '@sf_log:crash-';
const MAX_LOG_DAYS = 7;

const timestamp = () => new Date().toISOString().slice(11, 23);
const dateStr = () => new Date().toISOString().slice(0, 10);

// ─── AsyncStorage log writer (fire-and-forget) ─────────────────────
async function writeLog(level: string, message: string) {
  try {
    const key = `${LOG_PREFIX}${dateStr()}`;
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    const existing = await AsyncStorage.getItem(key);
    await AsyncStorage.setItem(key, (existing || `# ShadowField Crash Log — ${dateStr()}\n\n`) + line);
  } catch {
    // silently fail — don't crash the logger
  }
}

async function cleanOldLogs() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(k => k.startsWith(LOG_PREFIX)).sort();
    while (logKeys.length > MAX_LOG_DAYS) {
      const old = logKeys.shift()!;
      await AsyncStorage.removeItem(old);
    }
  } catch {
    // silently fail
  }
}

// ─── Exported helpers to read logs ─────────────────────────────────
export async function getLogDates(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter(k => k.startsWith(LOG_PREFIX))
      .map(k => k.replace(LOG_PREFIX, ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readLog(date: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(`${LOG_PREFIX}${date}`)) || '(empty)';
  } catch {
    return '(unable to read log)';
  }
}

export async function getLatestLog(): Promise<string> {
  const dates = await getLogDates();
  if (dates.length === 0) return '(no crash logs)';
  return readLog(dates[0]);
}

export async function clearAllLogs(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(k => k.startsWith(LOG_PREFIX));
    if (logKeys.length > 0) await AsyncStorage.multiRemove(logKeys);
  } catch {
    // silently fail
  }
}

// ─── Install interceptors in DEV mode ──────────────────────────────
if (__DEV__) {
  // Clean old logs on startup
  cleanOldLogs();

  // ─── 1. Global JS error handler ─────────────────────────────────
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const entry =
      `${isFatal ? 'FATAL' : 'NON-FATAL'} | ${error.message}\n` +
      `Stack:\n${error.stack?.split('\n').slice(0, 8).join('\n')}`;

    console.log(`\n🔴 [CRASH] ${timestamp()} ${isFatal ? 'FATAL' : 'NON-FATAL'}\n   Message: ${error.message}\n   Stack: ${error.stack?.split('\n').slice(0, 5).join('\n         ')}\n`);
    writeLog('CRASH', entry);
    defaultHandler(error, isFatal);
  });

  // ─── 2. Unhandled promise rejections ────────────────────────────
  const tracking = require('promise/setimmediate/rejection-tracking');
  tracking.enable({
    allRejections: true,
    onUnhandled: (id: number, error: any) => {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : '';

      console.log(`\n🟡 [PROMISE] ${timestamp()} Unhandled rejection #${id}\n   Message: ${msg}\n${stack ? `   Stack: ${stack}\n` : ''}`);
      writeLog('PROMISE', `#${id} | ${msg}\n${stack}`);
    },
    onHandled: (id: number) => {
      console.log(`✅ [PROMISE] ${timestamp()} Rejection #${id} was handled`);
    },
  });

  // ─── 3. Intercept console.error ─────────────────────────────────
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(a =>
      a instanceof Error ? a.message :
      typeof a === 'object' ? JSON.stringify(a, null, 2)?.slice(0, 300) :
      String(a)
    ).join(' ');

    if (msg.includes('Require cycle') || msg.includes('ViewPropTypes')) {
      return originalError(...args);
    }

    console.log(`🔴 [ERROR] ${timestamp()} ${msg.slice(0, 500)}`);
    writeLog('ERROR', msg.slice(0, 1000));
    originalError(...args);
  };

  // ─── 4. Intercept console.warn ──────────────────────────────────
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');

    if (msg.includes('Require cycle') || msg.includes('ViewPropTypes') || msg.includes('AsyncStorage')) {
      return originalWarn(...args);
    }

    console.log(`🟡 [WARN] ${timestamp()} ${msg.slice(0, 300)}`);
    // Only write warnings to file if they look important
    if (msg.includes('error') || msg.includes('fail') || msg.includes('crash') || msg.includes('deprecated')) {
      writeLog('WARN', msg.slice(0, 500));
    }
    originalWarn(...args);
  };

  // ─── 5. Network request logger (Supabase / fetch failures) ─────
  const originalFetch = global.fetch;
  global.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const method = (args[1]?.method || 'GET').toUpperCase();
    const start = Date.now();

    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - start;

      if (!response.ok) {
        const shortUrl = url.replace(/\?.*/, '').replace(/https?:\/\/[^/]+/, '');
        const entry = `${method} ${shortUrl} → ${response.status} (${duration}ms)`;
        console.log(`🔴 [NET] ${timestamp()} ${entry}`);
        writeLog('NET', entry);
      }

      return response;
    } catch (err) {
      const duration = Date.now() - start;
      const shortUrl = url.replace(/\?.*/, '').replace(/https?:\/\/[^/]+/, '');
      const entry = `${method} ${shortUrl} → FAILED (${duration}ms) | ${err instanceof Error ? err.message : String(err)}`;
      console.log(`🔴 [NET] ${timestamp()} ${entry}`);
      writeLog('NET', entry);
      throw err;
    }
  };

  console.log(`\n📱 [DEV] ${timestamp()} ShadowField dev logger active`);
  console.log(`📂 [DEV] Logs stored in AsyncStorage key: ${LOG_PREFIX}${dateStr()}\n`);
}
