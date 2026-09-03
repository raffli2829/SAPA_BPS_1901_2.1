'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  StatusBadge,
  EmptyState,
  Toast,
  Modal,
  TextareaField,
  Tabs,
} from '@/components/ui';
import { ReviewRepo, subscribe } from '@/lib/repository';
import { ReviewRequest, DataStatus } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils';
import { ClipboardCheck, CheckCircle, XCircle, Eye, Clock, User, Calendar } from 'lucide-react';

export default function ReviewPage() {
  const { isAuthenticated, isLoading, user, isReviewer } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewRequest[]>(() => {
    try {
      return ReviewRepo.getAll();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(() => {
    setReviews(ReviewRepo.getAll());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router, loadData]);

  const handleApprove = (reviewId: string) => {
    if (!user) return;
    ReviewRepo.approve(reviewId, user.id, user.name);
    setToast({ msg: 'Review disetujui. Dataset berhasil dipublikasikan!', type: 'success' });
  };

  const handleReject = () => {
    if (!user || !rejectModal) return;
    ReviewRepo.reject(rejectModal.id, user.id, user.name, rejectReason || 'Perlu perbaikan data');
    setToast({ msg: 'Review ditolak. Dataset dikembalikan ke status draf.', type: 'success' });
    setRejectModal(null);
    setRejectReason('');
  };

  const pending = reviews.filter((r) => r.status === 'PENDING');
  const completed = reviews.filter((r) => r.status !== 'PENDING');

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        pending={pending}
        completed={completed}
        loading={loading}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as 'pending' | 'history')}
        isReviewer={isReviewer}
        onApprove={handleApprove}
        onStartReject={(id) => setRejectModal({ id })}
      />
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
      {rejectModal && (
        <Modal
          open={true}
          onClose={() => { setRejectModal(null); setRejectReason(''); }}
          title="Tolak Pengajuan Review"
          variant="danger"
          description="Dataset ini akan dikembalikan ke status draf. Berikan catatan atau alasan penolakan agar operator data dapat memperbaikinya."
        >
          <TextareaField
            label="Catatan Alasan Penolakan"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Terdapat lonjakan data yang belum disertai penjelasan atau periode data 2024 belum lengkap..."
            rows={3}
          />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleReject}>
              Konfirmasi Tolak Review
            </Button>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

function PageContent({
  pending,
  completed,
  activeTab,
  onTabChange,
  isReviewer,
  onApprove,
  onStartReject,
  onMobileMenuOpen,
}: {
  pending: ReviewRequest[];
  completed: ReviewRequest[];
  loading: boolean;
  activeTab: 'pending' | 'history';
  onTabChange: (tab: string) => void;
  isReviewer: boolean;
  onApprove: (id: string) => void;
  onStartReject: (id: string) => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Verifikasi & Review Data"
        subtitle="Evaluasi dan publikasikan pengajuan data statistik"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 1080 }}>
        <Tabs
          tabs={[
            { value: 'pending', label: 'Menunggu Persetujuan', count: pending.length },
            { value: 'history', label: 'Riwayat Keputusan Review', count: completed.length },
          ]}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        {activeTab === 'pending' && (
          <div>
            {pending.length === 0 ? (
              <div className="section">
                <EmptyState
                  icon={<ClipboardCheck size={40} />}
                  title="Tidak Ada Antrean Review"
                  description="Semua pengajuan dataset telah diverifikasi. Dataset baru yang diajukan akan otomatis muncul di sini."
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pending.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-card-header">
                      <div>
                        <h4 className="review-card-title">{review.dataset_name}</h4>
                        <p className="review-card-desc">{review.description}</p>
                      </div>
                      <StatusBadge status={DataStatus.REVIEW} size="sm" />
                    </div>

                    <div className="review-card-meta">
                      <span>
                        <User size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Diajukan oleh: <strong>{review.submitted_by_name}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {getRelativeTime(review.submitted_at)}
                      </span>
                      <span>•</span>
                      <span>{review.record_ids.length} baris data terkait</span>
                    </div>

                    <div className="review-card-actions">
                      <Link href={`/datasets/${review.dataset_id}`}>
                        <Button variant="secondary" size="sm" icon={<Eye size={14} />}>
                          Periksa Data Detail
                        </Button>
                      </Link>
                      {isReviewer ? (
                        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                          <Button
                            variant="success"
                            size="sm"
                            icon={<CheckCircle size={14} />}
                            onClick={() => onApprove(review.id)}
                          >
                            Setujui & Publikasikan
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<XCircle size={14} />}
                            onClick={() => onStartReject(review.id)}
                          >
                            Tolak
                          </Button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center', marginLeft: 'auto' }}>
                          Hanya akun Reviewer yang dapat menyetujui
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {completed.length === 0 ? (
              <div className="section">
                <EmptyState
                  icon={<Clock size={40} />}
                  title="Belum Ada Riwayat Review"
                  description="Riwayat persetujuan dan penolakan review akan tercatat di sini."
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {completed.map((review) => (
                  <div key={review.id} className="review-card" style={{ background: '#ffffff' }}>
                    <div className="review-card-header">
                      <div>
                        <h4 className="review-card-title">{review.dataset_name}</h4>
                        <p className="review-card-desc">{review.description}</p>
                      </div>
                      <span
                        className={`badge badge-md ${
                          review.status === 'APPROVED' ? 'badge-published' : 'badge-draft'
                        }`}
                      >
                        <span className="badge-dot" />
                        {review.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                      </span>
                    </div>

                    <div className="review-card-meta">
                      {review.reviewed_by_name && (
                        <span>
                          <User size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Diputuskan oleh: <strong>{review.reviewed_by_name}</strong>
                        </span>
                      )}
                      {review.reviewed_at && (
                        <>
                          <span>•</span>
                          <span>
                            <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {getRelativeTime(review.reviewed_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {review.reject_reason && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          fontSize: 12.5,
                          color: '#b91c1c',
                        }}
                      >
                        <strong>Alasan Penolakan:</strong> {review.reject_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
