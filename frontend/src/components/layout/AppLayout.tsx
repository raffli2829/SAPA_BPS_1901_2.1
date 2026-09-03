'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          'app-main',
          collapsed ? 'app-main-collapsed' : 'app-main-expanded'
        )}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<{ onMobileMenuOpen?: () => void }>, {
              onMobileMenuOpen: () => setMobileOpen(true),
            });
          }
          return child;
        })}
      </div>
    </div>
  );
}
