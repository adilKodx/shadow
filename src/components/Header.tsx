import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, LogOut, User, Shield, MessageSquare, Volume2, VolumeX,
  AlertTriangle, ShieldAlert, Heart, CheckCircle, Radio, X, ChevronRight,
  Lock, Siren, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useAlerts } from '../hooks/useAlerts';
import { useNotifications, type AppNotification } from '../hooks/useNotifications';
import ToastNotifications from './ToastNotifications';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chat': 'Team Chat',
  '/alerts': 'Alerts',
  '/incidents': 'Incidents',
  '/poi': 'Persons of Interest',
  '/news': 'News & Updates',
  '/video-feeds': 'Video Feeds',
  '/team': 'Team Management',
  '/branding': 'Branding & White Label',
  '/settings': 'Settings',
  '/map': 'Live Map',
  '/sops': 'SOPs & Action Plans',
  '/white-label': 'White-Label & Pricing',
  '/attendance': 'Attendance & Check-In',
  '/changelog': 'Changelog',
};

const EMERGENCY_ACTIONS = [
  { key: 'lockdown', label: 'LOCKDOWN', icon: Lock, color: 'bg-red-700 hover:bg-red-800', alertType: 'lockdown', priority: 'critical' as const },
  { key: 'emergency', label: 'EMERGENCY', icon: Siren, color: 'bg-red-600 hover:bg-red-700', alertType: 'emergency', priority: 'critical' as const },
  { key: 'medical', label: 'MEDICAL', icon: Heart, color: 'bg-pink-600 hover:bg-pink-700', alertType: 'medical', priority: 'high' as const },
  { key: 'all_clear', label: 'ALL CLEAR', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700', alertType: 'all_clear', priority: 'normal' as const },
];

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { member, signOut } = useAuth();
  const { primaryColor } = useBranding();
  const { unacknowledgedAlerts, createAlert } = useAlerts();
  const {
    notifications, unreadCount, unreadChatCount,
    soundEnabled, setSoundEnabled,
    markRead, markAllRead, clearAll, resetChatCount,
  } = useNotifications();

  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const emergencyRef = useRef<HTMLDivElement>(null);

  const title = PAGE_TITLES[location.pathname] || 'ShadowField';
  const isAdmin = member?.role === 'owner' || member?.role === 'admin' || member?.role === 'supervisor';

  // Close panels on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowNotifPanel(false);
      if (emergencyRef.current && !emergencyRef.current.contains(e.target as Node)) {
        setShowEmergency(false);
        setConfirmAction(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigate to chat and reset chat count
  const goToChat = () => {
    resetChatCount();
    navigate('/chat');
  };

  // Send emergency alert
  const sendEmergencyAlert = async (action: typeof EMERGENCY_ACTIONS[0]) => {
    if (confirmAction !== action.key) {
      setConfirmAction(action.key);
      return;
    }
    await createAlert({
      alert_type: action.alertType,
      priority: action.priority,
      title: `${action.label} ACTIVATED`,
      message: `${action.label} initiated by ${member?.display_name}. All team members respond immediately.`,
      target_all: true,
    });
    setConfirmAction(null);
    setShowEmergency(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNotifClick = (notif: AppNotification) => {
    markRead(notif.id);
    setShowNotifPanel(false);
    if (notif.type === 'alert') navigate('/alerts');
    else if (notif.type === 'chat') { resetChatCount(); navigate('/chat'); }
    else if (notif.type === 'incident') navigate('/incidents');
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Emergency button */}
          {isAdmin && (
            <div className="relative" ref={emergencyRef}>
              <button
                onClick={() => { setShowEmergency(!showEmergency); setConfirmAction(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showEmergency
                    ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden sm:inline">EMERGENCY</span>
              </button>

              {showEmergency && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 z-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Alert Actions</p>
                  <div className="space-y-1.5">
                    {EMERGENCY_ACTIONS.map(action => {
                      const Icon = action.icon;
                      const isConfirming = confirmAction === action.key;
                      return (
                        <button
                          key={action.key}
                          onClick={() => sendEmergencyAlert(action)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-white text-sm font-bold transition-all ${action.color} ${
                            isConfirming ? 'ring-2 ring-offset-2 ring-yellow-400 animate-pulse' : ''
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          {isConfirming ? `TAP AGAIN TO CONFIRM ${action.label}` : action.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">Tap once to select, tap again to confirm & broadcast</p>
                </div>
              )}
            </div>
          )}

          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-500" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {/* Chat shortcut */}
          <button
            onClick={goToChat}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Team Chat"
          >
            <MessageSquare className="w-5 h-5 text-gray-600" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>

          {/* Notification bell with dropdown */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {(unreadCount + unacknowledgedAlerts.length) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {Math.min(unreadCount + unacknowledgedAlerts.length, 99)}
                </span>
              )}
            </button>

            {showNotifPanel && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-96 max-h-[70vh] flex flex-col z-50">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Notification list */}
                <div className="flex-1 overflow-y-auto max-h-[50vh]">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 flex items-start gap-3 ${
                          !notif.read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          notif.type === 'alert' ? 'bg-red-100 text-red-600' :
                          notif.type === 'chat' ? 'bg-blue-100 text-blue-600' :
                          notif.type === 'incident' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {notif.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> :
                           notif.type === 'chat' ? <MessageSquare className="w-4 h-4" /> :
                           notif.type === 'incident' ? <Shield className="w-4 h-4" /> :
                           <Bell className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{notif.title}</p>
                            {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{notif.body}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeSince(notif.timestamp)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                      </button>
                    ))
                  )}
                </div>

                {/* Panel footer */}
                <div className="border-t border-gray-100 px-4 py-2">
                  <button
                    onClick={() => { setShowNotifPanel(false); navigate('/alerts'); }}
                    className="w-full text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                  >
                    View All Alerts
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Changelog */}
          <button
            onClick={() => navigate('/changelog')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Changelog"
          >
            <ClipboardList className="w-4.5 h-4.5 text-gray-500" />
          </button>

          {/* User info */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200 ml-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}
            >
              {member?.display_name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{member?.display_name}</p>
              <p className="text-xs text-gray-500 capitalize leading-tight">{member?.role}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-1"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Toast notifications overlay */}
      <ToastNotifications notifications={notifications} onDismiss={markRead} />
    </>
  );
}
