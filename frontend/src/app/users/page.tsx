'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { UserRepo } from '@/lib/repository';
import { User, ROLE_LABELS } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Users as UsersIcon, Mail } from 'lucide-react';

export default function UsersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [users] = useState<User[]>(() => {
    try {
      return UserRepo.getAll();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent users={users} />
    </AppLayout>
  );
}

function PageContent({
  users,
  onMobileMenuOpen,
}: {
  users: User[];
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Daftar Pengguna Sistem"
        subtitle="Manajemen akun operator data dan verifikator BPS"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 1080 }}>
        {/* User Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: 'var(--shadow-subtle)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-full)',
                  background: user.role === 'REVIEWER' ? '#eff6ff' : '#f1f5f9',
                  color: user.role === 'REVIEWER' ? '#1d4ed8' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                  border: user.role === 'REVIEWER' ? '2px solid #bfdbfe' : '2px solid #e2e8f0',
                }}
              >
                {user.name.charAt(0)}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {user.name}
                  </h3>
                  <span
                    className={`badge badge-sm ${
                      user.role === 'REVIEWER' ? 'badge-published' : 'badge-draft'
                    }`}
                  >
                    <span className="badge-dot" />
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                  <Mail size={12} />
                  <span>{user.email}</span>
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Terdaftar: {formatDate(user.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed User Table */}
        <div className="section">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <UsersIcon size={16} style={{ color: '#2563eb' }} />
                Daftar Lengkap Hak Akses Pengguna
              </h3>
              <p className="section-subtitle">
                Hak akses input data makro dan hak verifikasi / publikasi review
              </p>
            </div>
          </div>
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Lengkap</th>
                  <th>Alamat Email</th>
                  <th>Peran (Role)</th>
                  <th>Wewenang Akses</th>
                  <th>Tanggal Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#f1f5f9',
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#475569' }}>{user.email}</td>
                    <td>
                      <span
                        className={`badge badge-md ${
                          user.role === 'REVIEWER' ? 'badge-published' : 'badge-draft'
                        }`}
                      >
                        <span className="badge-dot" />
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {user.role === 'REVIEWER'
                        ? 'Input, Edit, Review, Setujui, Publikasikan & Arsip Dataset'
                        : 'Input Data, Import Spreadsheet, Ajukan Review'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
