import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Fingerprint, Delete, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

interface PinLockProps {
  onUnlock: () => void;
}

export default function PinLock({ onUnlock }: PinLockProps) {
  const { member } = useAuth();
  const { appName } = useBranding();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState<'enter' | 'setup' | 'confirm'>('enter');
  const [setupPin, setSetupPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPinSet = member?.pin_enabled;

  useEffect(() => {
    if (!hasPinSet) {
      setMode('setup');
    }
  }, [hasPinSet]);

  // Try Web Authentication API (biometric)
  const tryBiometric = useCallback(async () => {
    if (!member?.biometric_enabled) return;
    if (!window.PublicKeyCredential) return;

    try {
      // Simple credential check — in production this would use WebAuthn
      // For now, we use the Credential Management API as a signal
      const cred = await navigator.credentials.get({
        mediation: 'optional',
        password: true,
      } as any);
      if (cred) {
        onUnlock();
      }
    } catch {
      // Biometric not available, fall back to PIN
    }
  }, [member, onUnlock]);

  useEffect(() => {
    if (hasPinSet) {
      tryBiometric();
    }
  }, [hasPinSet, tryBiometric]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      if (mode === 'enter') {
        verifyPin(newPin);
      } else if (mode === 'setup') {
        setSetupPin(newPin);
        setPin('');
        setMode('confirm');
      } else if (mode === 'confirm') {
        if (newPin === setupPin) {
          savePin(newPin);
        } else {
          setError('PINs do not match. Try again.');
          setShake(true);
          setTimeout(() => { setShake(false); setPin(''); setMode('setup'); setSetupPin(''); }, 1000);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const verifyPin = async (enteredPin: string) => {
    setChecking(true);
    const { data, error: err } = await supabase.rpc('verify_security_pin', { p_pin: enteredPin });
    setChecking(false);

    if (err || !data) {
      setError('Incorrect PIN');
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 600);
    } else {
      onUnlock();
    }
  };

  const savePin = async (newPin: string) => {
    setChecking(true);
    const { error: err } = await supabase.rpc('set_security_pin', { p_pin: newPin });
    setChecking(false);

    if (err) {
      setError('Failed to save PIN. Try again.');
      setPin('');
      setMode('setup');
      setSetupPin('');
    } else {
      onUnlock();
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{appName}</h1>
          <p className="text-blue-200 text-sm mt-1">
            {mode === 'enter' ? 'Enter your security PIN' : mode === 'setup' ? 'Create a 4-digit PIN' : 'Confirm your PIN'}
          </p>
        </div>

        {/* PIN dots */}
        <div className={`flex justify-center gap-4 mb-8 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-white scale-110'
                  : 'bg-white/20 border border-white/30'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-red-300 text-sm mb-4">{error}</p>
        )}

        {/* Checking spinner */}
        {checking && (
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />;
            if (d === 'del') {
              return (
                <button
                  key={i}
                  onClick={handleDelete}
                  className="h-16 rounded-2xl flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors active:bg-white/20"
                >
                  <Delete className="w-6 h-6" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => handleDigit(d)}
                disabled={checking}
                className="h-16 rounded-2xl bg-white/10 backdrop-blur-sm text-white text-2xl font-semibold hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Biometric option */}
        {mode === 'enter' && (
          <div className="mt-6 text-center">
            <button
              onClick={tryBiometric}
              className="inline-flex items-center gap-2 text-blue-200 text-sm hover:text-white transition-colors"
            >
              <Fingerprint className="w-5 h-5" />
              Use Biometrics
            </button>
          </div>
        )}

        {/* Skip setup */}
        {mode === 'setup' && (
          <div className="mt-6 text-center">
            <button
              onClick={onUnlock}
              className="text-blue-300 text-sm hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
      `}</style>
    </div>
  );
}
