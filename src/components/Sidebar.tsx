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
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['bishop', 'super_admin', 'shepherd', 'recorder'] },
  { name: 'New Believers', href: '/dashboard/new-believers', icon: Heart, roles: ['bishop', 'super_admin', 'recorder'] },
  { name: 'First Timers', href: '/dashboard/first-timers', icon: UserPlus, roles: ['bishop', 'super_admin', 'recorder'] },
  { name: 'My Sheep', href: '/dashboard/members', icon: Users, roles: ['shepherd'] },
  { name: 'Members', href: '/dashboard/members', icon: Users, roles: ['bishop', 'super_admin'] },
  { name: 'Bacentas', href: '/dashboard/bacentas', icon: FolderTree, roles: ['bishop', 'super_admin'] },
  { name: 'Shepherds', href: '/dashboard/shepherds', icon: Users, roles: ['bishop', 'super_admin'] },
  { name: 'Church Attendance', href: '/dashboard/church-attendance', icon: ClipboardList, roles: ['bishop', 'super_admin'] },
  { name: 'Attendance', href: '/dashboard/attendance', icon: CalendarCheck, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Follow-ups', href: '/dashboard/follow-ups', icon: Phone, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Visitations', href: '/dashboard/visitations', icon: MapPin, roles: ['bishop', 'super_admin', 'shepherd'] },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2, roles: ['bishop'] },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText, roles: ['bishop', 'super_admin'] },
  { name: 'EPC News', href: '/dashboard/epc-news', icon: Megaphone, roles: ['bishop', 'super_admin'] },
  { name: 'Prayers', href: '/dashboard/prayers', icon: BookHeart, roles: ['bishop', 'super_admin'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['bishop', 'super_admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  const filteredNav = navigation.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/logo.png" alt="EPC Logo" className="w-10 h-10 object-contain rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-black text-sm">Everything by Prayer</h1>
            <p className="text-xs text-gray-500">{profile?.branch?.name || 'Dashboard'}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
              }`}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-100">
        <div className="mb-3 px-4">
          <p className="text-sm font-medium text-black">{profile?.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
              profile?.role === 'super_admin'
                ? 'bg-orange-100 text-orange-700'
                : profile?.role === 'bishop'
                ? 'bg-purple-100 text-purple-700'
                : profile?.role === 'shepherd'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {profile?.role === 'recorder' ? 'NB Officer' : profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 w-full"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu size={24} className="text-black" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-white h-full shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1"
            >
              <X size={20} className="text-gray-500" />
            </button>
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <NavContent />
      </aside>
    </>
  );
}
