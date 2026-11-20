'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  LayoutDashboard,
  Upload,
  Search,
  Wrench,
  GitCompare,
  History,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Upload Dataset', href: '/upload', icon: Upload },
  { name: 'Data Analysis', href: '/analysis', icon: Search },
  { name: 'AI Repair Centre', href: '/repair', icon: Wrench, badge: 'AI' },
  { name: 'Before & After', href: '/compare', icon: GitCompare },
  { name: 'Audit History', href: '/audit', icon: History },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen bg-navy-900 border-r border-navy-700 select-none z-30 shrink-0"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-navy-700/60">
        <Link href="/" className="flex items-center gap-3 overflow-hidden group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <Database className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg text-white tracking-tight">DataFix</span>
                  <span className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    AI
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                  Autonomous Engine
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center h-11 px-3 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/10 text-white border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-navy-800/80 border border-transparent'
              }`}
              title={isCollapsed ? item.name : undefined}
            >
              {/* Active Left Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full"
                />
              )}

              <div className="flex items-center justify-center shrink-0">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-200'
                  }`}
                />
              </div>

              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between flex-1 ml-3 whitespace-nowrap overflow-hidden"
                  >
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer Collapse Toggle */}
      <div className="p-3 border-t border-navy-700/60">
        <button
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-full h-10 rounded-lg text-gray-400 hover:text-white hover:bg-navy-800 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center justify-between w-full px-2 text-xs font-medium">
              <span>Collapse Sidebar</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
