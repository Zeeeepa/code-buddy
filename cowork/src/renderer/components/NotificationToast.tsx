/**
 * NotificationToast — Auto-dismissing toast for new notifications
 * Claude Cowork parity: proactive agent notifications.
 */
import React, { useEffect, useState } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { useNotifications } from '../store/selectors';
import type { NotificationEntry, NotificationPriority } from '../types';

const PRIORITY_ICONS: Record<NotificationPriority, LucideIcon> = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: AlertCircle,
};

const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  low: 'border-border bg-background/95',
  normal: 'border-accent/50 bg-background/95',
  high: 'border-warning/70 bg-background/95',
  urgent: 'border-error/80 bg-background/95',
};

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: 'text-text-muted',
  normal: 'text-accent',
  high: 'text-warning',
  urgent: 'text-error',
};

const AUTO_DISMISS_MS: Record<NotificationPriority, number> = {
  low: 4000,
  normal: 6000,
  high: 8000,
  urgent: 0, // manual dismiss
};

interface ToastItemProps {
  notification: NotificationEntry;
  onDismiss: () => void;
  onMarkRead: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss, onMarkRead }) => {
  const [visible, setVisible] = useState(false);
  const Icon = PRIORITY_ICONS[notification.priority];

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    const timeout = AUTO_DISMISS_MS[notification.priority];
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [notification.priority, onDismiss]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`pointer-events-auto transform transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } w-80 rounded-lg border shadow-2xl backdrop-blur-sm ${
        PRIORITY_STYLES[notification.priority]
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div className={`shrink-0 mt-0.5 ${PRIORITY_COLORS[notification.priority]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0" onClick={onMarkRead}>
          <h4 className="text-xs font-semibold text-text-primary truncate">
            {notification.title}
          </h4>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{notification.body}</p>
          {notification.actionLabel && (
            <button className="mt-1.5 text-[11px] text-accent hover:text-accent-hover font-medium">
              {notification.actionLabel}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

/** Container that displays recent unread notifications as toasts */
export const NotificationToastContainer: React.FC = () => {
  const notifications = useNotifications();
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const removeNotification = useAppStore((s) => s.removeNotification);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Show only unread + non-dismissed, max 3
  const visibleToasts = notifications
    .filter((n) => !n.read && !dismissedIds.has(n.id))
    .slice(0, 3);

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {visibleToasts.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={() => {
            setDismissedIds((prev) => new Set([...prev, notification.id]));
            // Remove from store after a delay so count decrements correctly
            setTimeout(() => removeNotification(notification.id), 500);
          }}
          onMarkRead={() => markNotificationRead(notification.id)}
        />
      ))}
    </div>
  );
};
