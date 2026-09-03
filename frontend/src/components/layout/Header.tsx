'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { MobileMenuButton } from './Sidebar';
import { LogOut, ArrowLeft, Shield } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMobileMenuOpen: () => void;
  actions?: React.ReactNode;
  backHref?: string;
  onBack?: () => void;
}

export default function Header({
  title,
  subtitle,
  onMobileMenuOpen,
  actions,
  backHref,
  onBack,
}: HeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        <MobileMenuButton onClick={onMobileMenuOpen} />
        {backHref ? (
          <Link href={backHref} className="header-back-btn" title="Kembali">
            <ArrowLeft size={16} />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} className="header-back-btn" title="Kembali">
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <div className="header-title-group">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        {actions}
        {isAuthenticated && user && (
          <div className="header-user">
            <div className="header-user-info">
              <span className="header-user-name">{user.name}</span>
              <span className="header-user-role">
                {user.role === 'REVIEWER' && (
                  <Shield size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle', color: '#1d4ed8' }} />
                )}
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <button
              className="header-logout-btn"
              onClick={logout}
              title="Keluar dari sistem"
              type="button"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
