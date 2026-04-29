import { useState, useMemo } from 'react';
import {
  Plus, Copy, Check, X, Shield, Clock, Trash2, KeyRound, UserPlus,
  ArrowUpCircle, AlertTriangle, Zap, Search, Crown, Eye, UserCheck,
  ChevronDown, ChevronRight, Ticket, Mail, Send, Link2,
} from 'lucide-react';
import { useTeam, MEMBER_ROLES, PLAN_TIERS } from '../hooks/useTeam';
import AddMemberModal from '../components/AddMemberModal';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { formatDistanceToNow } from 'date-fns';

// --- Role hierarchy groups with security-ops theming ---
const ROLE_GROUPS: { key: string; label: string; roles: string[]; icon: typeof Crown; gradient: string; bg: string; border: string; text: string; badge: string }[] = [
  { key: 'command', label: 'Command', roles: ['owner', 'admin'], icon: Crown, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50/60', border: 'border-amber-200/60', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  { key: 'operations', label: 'Operations', roles: ['supervisor'], icon: Shield, gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50/60', border: 'border-blue-200/60', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  { key: 'field', label: 'Field Team', roles: ['member'], icon: UserCheck, gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50/60', border: 'border-emerald-200/60', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  { key: 'observers', label: 'Observers', roles: ['viewer'], icon: Eye, gradient: 'from-slate-400 to-gray-500', bg: 'bg-gray-50/60', border: 'border-gray-200/60', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' },
];

// --- Radial SVG seat gauge ---
function SeatGauge({ used, total, color }: { used: number; total: number; color: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const full = used >= total && total < 999;
  return (
    <div className="relative w-[104px] h-[104px] flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none"
          stroke={full ? '#ef4444' : color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{used}</span>
        <div className="w-5 h-px bg-white/20 my-0.5" />
        <span className="text-xs text-white/50 font-semibold">{total === 999 ? '8' : total}</span>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { tenant, member } = useAuth();
  const { primaryColor } = useBranding();
  const {
    members, activeMembers, invites, loading,
    memberCount, memberLimit, seatsRemaining, canInvite, usagePercent,
    currentTier, nextTier,
    updateMember, removeMember, addMember, createInvite, revokeInvite, upgradeTier,
  } = useTeam();

  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['command', 'operations', 'field', 'observers']);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';
  const tierInfo = PLAN_TIERS.find(t => t.key === currentTier);
  const atCapacity = !canInvite;

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const isRecentlyActive = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 15 * 60 * 1000;
  };

  const groupedMembers = useMemo(() => {
    const q = search.toLowerCase();
    return ROLE_GROUPS.map(group => ({
      ...group,
      members: activeMembers
        .filter(m => group.roles.includes(m.role))
        .filter(m => !q || m.display_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)),
    }));
  }, [activeMembers, search]);

  const resetInviteForm = () => {
    setShowInviteForm(false);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('member');
    setInviteError('');
    setInviteSent(false);
    setInviteLink('');
    setCopiedCode('');
  };

  const handleCreateInvite = async () => {
    setInviteError('');
    if (!inviteEmail.trim()) { setInviteError('Please enter an email address.'); return; }
    if (!canInvite) {
      setInviteError(`Your ${tierInfo?.name || 'current'} plan allows ${memberLimit} members. Upgrade to add more.`);
      return;
    }
    const result = await createInvite(inviteRole, 1, inviteEmail.trim(), inviteName.trim());
    if (result?.error && typeof result.error === 'string') { setInviteError(result.error); return; }
    if (result?.error && typeof result.error === 'object') { setInviteError((result.error as any).message || 'Failed to create invite'); return; }
    if (result?.data) {
      const code = result.data.code;
      const link = `${window.location.origin}/signup?invite=${code}`;
      setCopiedCode(code);
      setInviteLink(link);
      setInviteSent(true);

      // Open email client with pre-composed invite
      const name = inviteName.trim() || 'there';
      const tenantName = tenant?.name || 'our team';
      const roleName = MEMBER_ROLES.find(r => r.value === inviteRole)?.label || inviteRole;
      const subject = encodeURIComponent(`You're invited to join ${tenantName}`);
      const body = encodeURIComponent(
        `Hi ${name},\n\nYou've been invited to join ${tenantName} as a ${roleName}.\n\nClick the link below to accept your invitation:\n${link}\n\nOr use this invite code during signup: ${code}\n\nSee you on the team!`
      );
      window.open(`mailto:${inviteEmail.trim()}?subject=${subject}&body=${body}`, '_self');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleRoleChange = async (memberId: string) => {
    if (!editRole) return;
    await updateMember(memberId, { role: editRole as any });
    setEditingMember(null);
  };

  const handleUpgrade = async (tierKey: string) => {
    setUpgrading(true);
    await upgradeTier(tierKey);
    setUpgrading(false);
    setShowUpgrade(false);
  };

  // ---------------------------------------------------------
  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      {/* ------- HERO COMMAND BANNER ------- */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, ${primaryColor}22 100%)` }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${primaryColor}, transparent 70%)` }} />

        <div className="relative max-w-6xl mx-auto px-6 py-6 flex items-center gap-6">
          <SeatGauge used={memberCount} total={memberLimit} color={primaryColor} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-lg font-bold text-white tracking-tight">Team Roster</h1>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                currentTier === 'enterprise' ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30' :
                currentTier === 'ministry' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30' :
                currentTier === 'professional' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' :
                'bg-white/10 text-white/50 ring-1 ring-white/10'
              }`}>{tierInfo?.name}</span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed">
              {seatsRemaining > 0 && seatsRemaining < 999 ? <>{seatsRemaining} seat{seatsRemaining !== 1 ? 's' : ''} available</> :
               seatsRemaining >= 999 ? 'Unlimited seats' : <span className="text-amber-400/70">All seats occupied</span>}
              {atCapacity && nextTier && <span className="text-amber-400/60"> � upgrade for {nextTier.members === 999 ? 'unlimited' : nextTier.members} seats</span>}
            </p>
            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors" />
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={() => setShowAddMember(true)}
                disabled={atCapacity}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  atCapacity
                    ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                }`}>
                <UserPlus className="w-4 h-4" /> Add Member
              </button>
              <button onClick={() => { setShowInviteForm(true); setInviteError(''); setInviteSent(false); }}
                disabled={atCapacity}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  atCapacity
                    ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                    : 'bg-white text-slate-900 hover:bg-white/90 shadow-lg shadow-black/20'
                }`}>
                <Mail className="w-4 h-4" /> Invite
              </button>
              {atCapacity && nextTier && (
                <button onClick={() => setShowUpgrade(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all">
                  <ArrowUpCircle className="w-4 h-4" /> Upgrade
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------- SCROLLABLE CONTENT ------- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

          {/* --- ROLE-GROUPED SECTIONS --- */}
          {groupedMembers.map(group => {
            if (group.members.length === 0 && !isAdmin) return null;
            const GroupIcon = group.icon;
            const isOpen = expandedGroups.includes(group.key);
            return (
              <div key={group.key} className="animate-in">
                <button onClick={() => toggleGroup(group.key)}
                  className="flex items-center gap-2.5 mb-3 group/hdr w-full text-left">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${group.gradient} flex items-center justify-center shadow-sm`}>
                    <GroupIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">{group.label}</span>
                  <span className={`text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-bold ${group.badge}`}>
                    {group.members.length}
                  </span>
                  <div className="flex-1 h-px bg-gray-100 mx-2" />
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-300 group-hover/hdr:text-gray-500 transition-colors" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover/hdr:text-gray-500 transition-colors" />}
                </button>

                {isOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-1">
                    {group.members.map(m => {
                      const role = MEMBER_ROLES.find(r => r.value === m.role);
                      const active = isRecentlyActive(m.last_seen_at);
                      const isEditing = editingMember === m.id;
                      return (
                        <div key={m.id}
                          className={`group/card relative rounded-xl border p-4 transition-all duration-200 ${
                            !m.is_active ? 'opacity-40 border-gray-200 bg-gray-50' :
                            `${group.border} ${group.bg} hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5`
                          }`}>
                          <div className="absolute top-3.5 right-3.5">
                            <div className="relative">
                              <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                              {active && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />}
                            </div>
                          </div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${group.gradient} flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0`}>
                              {m.display_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{m.display_name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{m.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-lg text-[11px] bg-white outline-none focus:ring-1 focus:ring-blue-300">
                                  {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                                <button onClick={() => handleRoleChange(m.id)}
                                  className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600">Save</button>
                                <button onClick={() => setEditingMember(null)}
                                  className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${role?.color}`}>{role?.label}</span>
                                {m.last_seen_at ? (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatDistanceToNow(new Date(m.last_seen_at), { addSuffix: true })}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-300 italic">Never seen</span>
                                )}
                              </>
                            )}
                          </div>
                          {isAdmin && m.role !== 'owner' && m.id !== member?.id && !isEditing && (
                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                              <button onClick={() => { setEditingMember(m.id); setEditRole(m.role); }}
                                className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors" title="Change role">
                                <Shield className="w-3 h-3 text-gray-500" />
                              </button>
                              <button onClick={() => removeMember(m.id)}
                                className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors" title="Remove member">
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          )}
                          {!m.is_active && (
                            <span className="absolute top-3.5 left-3.5 text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold uppercase">Inactive</span>
                          )}
                        </div>
                      );
                    })}
                    {group.members.length === 0 && isAdmin && (
                      <div className={`rounded-xl border-2 border-dashed ${group.border} p-8 flex flex-col items-center justify-center text-center col-span-full sm:col-span-1`}>
                        <GroupIcon className={`w-6 h-6 ${group.text} opacity-20 mb-2`} />
                        <p className="text-[11px] text-gray-400">No {group.label.toLowerCase()} assigned</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* --- PENDING INVITES --- */}
          {isAdmin && invites.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Ticket className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">Pending Invites</span>
                <span className="text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-bold bg-violet-100 text-violet-800">{invites.length}</span>
                <div className="flex-1 h-px bg-gray-100 mx-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {invites.map(inv => (
                  <div key={inv.id} className="relative rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-purple-50/60 p-4 overflow-hidden group/inv hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-violet-500/[0.06]" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 rounded-full bg-purple-500/[0.04]" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-violet-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-violet-900 truncate">{inv.invited_name || inv.invited_email || 'Unnamed'}</p>
                            {inv.invited_email && <p className="text-[11px] text-violet-500 truncate">{inv.invited_email}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/inv:opacity-100 transition-opacity">
                          <button onClick={() => copyToClipboard(`${window.location.origin}/signup?invite=${inv.code}`)}
                            className="p-1.5 bg-white rounded-lg shadow-sm border border-violet-200 hover:bg-violet-50" title="Copy invite link">
                            {copiedCode === `${window.location.origin}/signup?invite=${inv.code}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3 text-violet-400" />}
                          </button>
                          <button onClick={() => revokeInvite(inv.id)} className="p-1.5 bg-white rounded-lg shadow-sm border border-violet-200 hover:bg-red-50" title="Revoke">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold capitalize">{inv.role}</span>
                        <span className="text-violet-400">�</span>
                        <span className="text-violet-500 font-medium">{inv.used_count > 0 ? 'Accepted' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------- OVERLAY: EMAIL INVITE ------- */}
      {showInviteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={resetInviteForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Invite Team Member</h3>
                  <p className="text-[11px] text-white/40">Send an email invitation to join your team</p>
                </div>
              </div>
              <button onClick={resetInviteForm} className="p-1 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {!inviteSent ? (
              <>
                <div className="p-6 space-y-4">
                  {inviteError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-700">{inviteError}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Email Address *</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com" autoFocus
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-colors">
                      {MEMBER_ROLES.filter(r => r.value !== 'owner').map(r => <option key={r.value} value={r.value}>{r.label} � {r.description}</option>)}
                    </select>
                  </div>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={handleCreateInvite}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-xl hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all">
                    <Send className="w-4 h-4" /> Send Invite
                  </button>
                  <button onClick={resetInviteForm}
                    className="px-5 py-2.5 bg-gray-100 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Invite sent!</p>
                    <p className="text-xs text-emerald-700">Your email app should open with the invitation for <strong>{inviteEmail}</strong>.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Invite Link</label>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={inviteLink}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-600 font-mono outline-none" />
                    <button onClick={() => copyToClipboard(inviteLink)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
                      {copiedCode === inviteLink ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Share this link directly if the email didn't open</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setInviteSent(false); setInviteEmail(''); setInviteName(''); setInviteLink(''); }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Invite Another
                  </button>
                  <button onClick={resetInviteForm}
                    className="px-5 py-2.5 bg-gray-100 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} onAdd={addMember} />

      {/* ------- OVERLAY: UPGRADE ------- */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowUpgrade(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upgrade Your Plan</h3>
                  <p className="text-xs text-white/40">More seats, more capability</p>
                </div>
              </div>
              <button onClick={() => setShowUpgrade(false)} className="p-1 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PLAN_TIERS.map(tier => {
                  const isCurrent = tier.key === currentTier;
                  const isDowngrade = tier.members <= memberLimit && !isCurrent;
                  return (
                    <div key={tier.key}
                      className={`relative rounded-xl border-2 p-5 text-center transition-all duration-200 ${
                        isCurrent ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10' :
                        isDowngrade ? 'border-gray-100 bg-gray-50/50 opacity-40' :
                        'border-gray-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5'
                      }`}>
                      {isCurrent && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-full">Current</div>}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{tier.name}</p>
                      <p className="text-3xl font-black text-gray-900">{tier.price > 0 ? `$${tier.price}` : '�'}</p>
                      <p className="text-[10px] text-gray-400 mb-3">{tier.price > 0 ? '/month' : 'Contact us'}</p>
                      <div className="text-xs font-semibold text-gray-600 mb-4">
                        {tier.members === 999 ? 'Unlimited' : tier.members} member{(tier.members as number) !== 1 ? 's' : ''}
                      </div>
                      {isCurrent ? null : isDowngrade ? (
                        <span className="text-[10px] text-gray-400">Too few seats</span>
                      ) : (
                        <button onClick={() => handleUpgrade(tier.key)} disabled={upgrading}
                          className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-lg hover:from-blue-500 hover:to-blue-400 shadow-sm disabled:opacity-50 transition-all">
                          {upgrading ? 'Upgrading...' : 'Upgrade'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
