'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Heart,
  UserPlus,
  Users,
  CalendarCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Megaphone,
  BookHeart,
  FolderTree,
  Bell,
  Phone,
  MapPin,
  Building2,
  FileText,
  ClipboardList,
  Gift,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const SIDEBAR_KEY = 'epc-sidebar-collapsed';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['bishop', 'super_admin', 'shepherd', 'recorder'] },
  { name: 'New Believers', href: '/dashboard/new-believers', icon: Heart, roles: ['bishop', 'super_admin', 'recorder'] },
  { name: 'First Timers', href: '/dashboard/first-timers', icon: UserPlus, roles: ['bishop', 'super_admin', 'recorder'] },
  { name: 'My Sheep', href: '/dashboard/regular-members', icon: Users, roles: ['shepherd'] },
  { name: 'Members', href: '/dashboard/regular-members', icon: Users, roles: ['bishop', 'super_admin'] },
  { name: 'Bacentas', href: '/dashboard/bacentas', icon: FolderTree, roles: ['bishop', 'super_admin'] },
  { name: 'Shepherds', href: '/dashboard/shepherds', icon: Users, roles: ['bishop', 'super_admin'] },
  { name: 'Church Attendance', href: '/dashboard/church-attendance', icon: ClipboardList, roles: ['bishop', 'super_admin'] },
  { name: 'Birthdays', href: '/dashboard/birthdays', icon: Gift, roles: ['bishop', 'super_admin'] },
  { name: "Shepherd's Data", href: '/dashboard/attendance', icon: CalendarCheck, roles: ['bishop', 'shepherd'] },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Follow-ups', href: '/dashboard/follow-ups', icon: Phone, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Visitations', href: '/dashboard/visitations', icon: MapPin, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2, roles: ['bishop'] },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText, roles: ['bishop', 'super_admin'] },
  { name: 'EPC News', href: '/dashboard/epc-news', icon: Megaphone, roles: ['bishop', 'super_admin'] },
  { name: 'Prayers', href: '/dashboard/prayers', icon: BookHeart, roles: ['bishop', 'super_admin'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['bishop', 'super_admin'] },
];

function roleBadgeClass(role?: string) {
  if (role === 'super_admin') return 'bg-orange-100 text-orange-800';
  if (role === 'bishop') return 'bg-purple-100 text-purple-800';
  if (role === 'shepherd') return 'bg-blue-100 text-blue-800';
  return 'bg-green-100 text-green-800';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();

  const filteredNav = navigation.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    setCollapsed(saved === '1');
  }, []);

  useEffect(() => {
    const width = collapsed ? '4.75rem' : '18rem';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [collapsed]);

  useEffect(() => {
    filteredNav.forEach((item) => router.prefetch(item.href));
  }, [router, profile?.role]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navContent = (compact: boolean) => (
    <div className="flex flex-col h-full">
      <div className={`border-b border-gray-100 ${compact ? 'p-3' : 'p-5'}`}>
        <div className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}>
          <img src="/logo.png" alt="Everything by Prayer" className="w-10 h-10 object-contain rounded-full shrink-0" />
          {!compact && (
            <div className="min-w-0">
              <h1 className="font-semibold text-black text-sm leading-tight text-balance">Everything by Prayer</h1>
              <p className="text-xs text-neutral-600 truncate mt-0.5">{profile?.branch?.name || 'Dashboard'}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 px-2 py-3 space-y-0.5" aria-label="Main">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              onClick={() => setMobileOpen(false)}
              className={`group relative flex items-center rounded-lg text-sm font-medium outline-none transition-colors duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                compact ? 'justify-center h-11 w-full' : 'gap-3 h-11 px-3'
              } ${
                isActive
                  ? 'bg-orange-50 text-orange-800'
                  : 'text-neutral-700 hover:bg-neutral-50 hover:text-black'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-orange-500" aria-hidden />
              )}
              <item.icon size={20} className="shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
              {!compact && <span className="truncate">{item.name}</span>}
              {compact && (
                <span className="pointer-events-none absolute left-full ml-2 z-20 hidden rounded-md bg-neutral-900 px-2 py-1 text-xs text-white whitespace-nowrap group-hover:block">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-gray-100 ${compact ? 'p-2' : 'p-3'}`}>
        {!compact && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-black truncate">{profile?.full_name}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass(profile?.role)}`}>
              {profile?.role === 'recorder' ? 'NB Officer' : profile?.role?.replace('_', ' ')}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className={`flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium text-red-700 bg-red-50 border border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors duration-200 motion-reduce:transition-none w-full outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${compact ? 'px-0' : 'px-3'}`}
        >
          <LogOut size={18} />
          {!compact && 'Log out'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 min-h-11 min-w-11 bg-white rounded-lg shadow-md border border-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        aria-label="Open menu"
      >
        <Menu size={22} className="text-black" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-white h-full shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 min-h-11 min-w-11 rounded-lg hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Close menu"
            >
              <X size={20} className="text-neutral-600" />
            </button>
            {navContent(false)}
          </div>
        </div>
      )}

      <aside
        className="relative hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-30 transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: collapsed ? '4.75rem' : '18rem' }}
      >
        {navContent(collapsed)}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-neutral-600 shadow-sm hover:bg-orange-50 hover:text-orange-700 outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </aside>
    </>
  );
}
