'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

export interface Notification {
  notif_id: number;
  message: string;
  type: string;
  status: string;
  related_type?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  slug: string;
  className?: string;
}

export default function NotificationCenter({ slug, className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function fetchNotifications() {
    try {
      setLoading(true);
      const data = await api<Notification[]>(slug, '/api/members/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch {
      // Graceful fallback for unauthenticated / non-member
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [slug]);

  // Click-outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAsRead(notifId: number) {
    try {
      await api(slug, `/api/members/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    await Promise.allSettled(
      unread.map((n) =>
        api(slug, `/api/members/notifications/${n.notif_id}/read`, { method: 'PATCH' })
      )
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Bell Button with Gold Accent & Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative p-2.5 text-[#0d4734] hover:text-[#c89b3c] rounded-full hover:bg-[#f6f3eb] transition-all flex items-center justify-center border border-[#c89b3c]/20"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-black text-white bg-[#0d4734] border-2 border-[#c89b3c] rounded-full shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-[12px] shadow-2xl border-2 border-[#c89b3c]/30 z-50 overflow-hidden text-left animate-fade-in font-sans">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#c89b3c]/20 flex items-center justify-between bg-[#f6f3eb]">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734]">
                DISPATCHES
              </span>
              {unreadCount > 0 && (
                <span className="text-[9px] bg-[#0d4734] text-white font-black px-2 py-0.5 rounded-full">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[9px] text-[#c89b3c] font-black uppercase tracking-widest hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#c89b3c]/15">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-wider text-[#1c2421]/50">
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-wider text-[#1c2421]/50">
                No active notifications in your inbox.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notif_id}
                  onClick={() => !notif.is_read && markAsRead(notif.notif_id)}
                  className={`p-4 transition-colors cursor-pointer flex items-start space-x-3 ${
                    notif.is_read
                      ? 'bg-white opacity-70 hover:bg-[#fcfbfa]'
                      : 'bg-[#f6f3eb] hover:bg-[#faf6ee]'
                  }`}
                >
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      notif.is_read ? 'bg-transparent' : 'bg-[#c89b3c]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734]">
                        {notif.type}
                      </span>
                      <time className="text-[9px] font-mono text-[#1c2421]/50">
                        {new Date(notif.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p className="text-xs text-[#1c2421]/80 leading-relaxed font-normal break-words">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
