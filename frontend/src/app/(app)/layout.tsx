'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import { motion } from 'framer-motion';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-navy-950 text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-6 md:p-8 max-w-7xl w-full mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
