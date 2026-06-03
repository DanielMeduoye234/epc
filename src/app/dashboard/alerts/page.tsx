'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Alert } from '@/lib/types';
import { DEMO_ALERTS } from '@/lib/demo-data';
import { Bell, AlertTriangle, Cake, TrendingUp, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function AlertsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'absence' | 'birthday' | 'promotion_ready'>('all');

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setAlerts(DEMO_ALERTS);
        setLoading(false);
      } else {
        fetchAlerts();
      }
    }
  }, [profile, isDemo]);

  async function fetchAlerts() {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('created_at', { ascending: false });
    setAlerts((data || []) as Alert[]);
    setLoading(false);
  }

  const markRead = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    if (!isDemo) {
      await supabase.from('alerts').update({ is_read: true }).eq('id', id);
    }
  };

  const markAllRead = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    if (!isDemo) {
      await supabase.from('alerts').update({ is_read: true }).eq('branch_id', profile!.branch_id);
    }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'all') return true;
    return a.type === filter;
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'absence': return <AlertTriangle size={18} className="text-red-500" />;
      case 'birthday': return <Cake size={18} className="text-pink-500" />;
      case 'promotion_ready': return <TrendingUp size={18} className="text-green-500" />;
      default: return <Bell size={18} className="text-orange-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50/50';
      case 'medium': return 'border-l-amber-500 bg-amber-50/30';
      case 'low': return 'border-l-green-500 bg-green-50/30';
      default: return 'border-l-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <Bell className="text-orange-500" size={26} />
            Alerts & Notifications
          </h1>
          <p className="text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition font-medium"
          >
            <CheckCircle size={16} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'absence', label: '🚨 Absence' },
          { key: 'birthday', label: '🎂 Birthday' },
          { key: 'promotion_ready', label: '⬆️ Promotion' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === tab.key
                ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filtered.map(alert => (
          <div
            key={alert.id}
            className={`relative border-l-4 rounded-xl p-4 sm:p-5 shadow-sm transition ${getPriorityColor(alert.priority)} ${
              alert.is_read ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(alert.type)}</div>
                <div>
                  <p className={`font-medium text-black text-sm sm:text-base ${!alert.is_read ? 'font-semibold' : ''}`}>
                    {alert.title}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-400">
                      {new Date(alert.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {alert.member_id && (
                      <Link
                        href={`/dashboard/profile/member/${alert.member_id}`}
                        className="text-[10px] text-orange-600 hover:text-orange-700 font-medium"
                      >
                        View Profile →
                      </Link>
                    )}
                    {alert.type === 'promotion_ready' && (
                      <button className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium hover:bg-green-200">
                        Promote Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!alert.is_read && (
                <button
                  onClick={() => markRead(alert.id)}
                  className="p-1 hover:bg-white/80 rounded text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {!alert.is_read && (
              <div className="absolute top-4 right-4 w-2 h-2 bg-orange-500 rounded-full"></div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p>No alerts to show</p>
          </div>
        )}
      </div>
    </div>
  );
}
