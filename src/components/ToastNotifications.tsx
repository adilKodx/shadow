import { useState, useEffect } from 'react';
import { X, Bell, MessageSquare, AlertTriangle, Shield, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '../hooks/useNotifications';

interface ToastProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'border-l-4 border-l-red-600 bg-red-50',
  high: 'border-l-4 border-l-orange-500 bg-orange-50',
  normal: 'border-l-4 border-l-blue-500 bg-white',
  low: 'border-l-4 border-l-gray-400 bg-white',
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  alert: AlertTriangle,
  chat: MessageSquare,
  incident: Shield,
  system: Bell,
};

export default function ToastNotifications({ notifications, onDismiss }: ToastProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState<string[]>([]);

  // Show new notifications as toasts, auto-dismiss after 6s (critical: 12s)
  useEffect(() => {
    const recent = notifications.filter(n => !n.read).slice(0, 3);
    const newIds = recent.map(n => n.id).filter(id => !visible.includes(id));

    if (newIds.length > 0) {
      setVisible(prev => [...newIds, ...prev].slice(0, 3));

      newIds.forEach(id => {
        const notif = notifications.find(n => n.id === id);
        const timeout = notif?.priority === 'critical' ? 12000 : 6000;
        setTimeout(() => {
          setVisible(prev => prev.filter(v => v !== id));
        }, timeout);
      });
    }
  }, [notifications]);

  const handleClick = (notif: AppNotification) => {
    onDismiss(notif.id);
    setVisible(prev => prev.filter(v => v !== notif.id));
    if (notif.type === 'alert') navigate('/alerts');
    else if (notif.type === 'chat') navigate('/chat');
    else if (notif.type === 'incident') navigate('/incidents');
  };

  const toasts = visible
    .map(id => notifications.find(n => n.id === id))
    .filter(Boolean) as AppNotification[];

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 w-96 pointer-events-none">
      {toasts.map((notif, idx) => {
        const Icon = TYPE_ICONS[notif.type] || Bell;
        return (
          <div
            key={notif.id}
            className={`pointer-events-auto rounded-xl shadow-2xl ${PRIORITY_STYLES[notif.priority] || PRIORITY_STYLES.normal} p-4 cursor-pointer hover:shadow-3xl transition-all duration-300 animate-slide-in`}
            onClick={() => handleClick(notif)}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                notif.priority === 'critical' ? 'bg-red-600 text-white animate-pulse' :
                notif.priority === 'high' ? 'bg-orange-500 text-white' :
                'bg-blue-100 text-blue-600'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{notif.title}</p>
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400">Just now</span>
                  <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                    Tap to view <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notif.id);
                  setVisible(prev => prev.filter(v => v !== notif.id));
                }}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
