import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import PinLock from './PinLock';

interface PinLockGateProps {
  children: ReactNode;
}

export default function PinLockGate({ children }: PinLockGateProps) {
  const { member } = useAuth();
  const [locked, setLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeoutMs = (member?.lock_timeout_minutes ?? 5) * 60 * 1000;
  const pinEnabled = member?.pin_enabled ?? false;

  // Track user activity
  useEffect(() => {
    if (!pinEnabled) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('touchstart', resetActivity);
    window.addEventListener('click', resetActivity);

    // Check for inactivity
    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current > timeoutMs) {
        setLocked(true);
      }
    }, 10000); // check every 10s

    // Lock on visibility change (tab switch, screen lock)
    const handleVisibility = () => {
      if (document.hidden) {
        // Start a timeout — if they come back within 30s, don't lock
        setTimeout(() => {
          if (document.hidden) {
            setLocked(true);
          }
        }, 30000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('touchstart', resetActivity);
      window.removeEventListener('click', resetActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pinEnabled, timeoutMs]);

  const handleUnlock = () => {
    setLocked(false);
    lastActivityRef.current = Date.now();
  };

  if (locked && pinEnabled) {
    return <PinLock onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
}
