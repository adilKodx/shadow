import { useState } from 'react';
import { UserPlus, X, AlertTriangle, Check, Plus } from 'lucide-react';
import { MEMBER_ROLES } from '../hooks/useTeam';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string, password: string, displayName: string, role: string) => Promise<{ error: string | null }>;
}

export default function AddMemberModal({ open, onClose, onAdd }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail(''); setPassword(''); setName(''); setRole('member');
    setError(''); setSuccess(false); setLoading(false);
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password.trim() || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!name.trim()) { setError('Display name is required'); return; }
    setLoading(true);
    const result = await onAdd(email.trim(), password, name.trim(), role);
    setLoading(false);
    if (result?.error) { setError(result.error); return; }
    setSuccess(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={reset}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Team Member</h3>
              <p className="text-xs text-white/60">Create account and add to team directly</p>
            </div>
          </div>
          <button onClick={reset} className="p-1 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {!success ? (
          <div className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Display Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-300 bg-white transition-all">
                {MEMBER_ROLES.filter(r => r.value !== 'owner').map(r => (
                  <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold rounded-xl hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {loading ? 'Adding...' : <><UserPlus className="w-4 h-4" /> Add Member</>}
              </button>
              <button onClick={reset}
                className="px-5 py-3 bg-gray-100 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Member added successfully!</p>
                <p className="text-xs text-emerald-700"><strong>{name}</strong> ({email}) added as <strong>{MEMBER_ROLES.find(r => r.value === role)?.label}</strong>.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSuccess(false); setEmail(''); setPassword(''); setName(''); }}
                className="flex-1 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Another
              </button>
              <button onClick={reset}
                className="px-5 py-3 bg-gray-100 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
