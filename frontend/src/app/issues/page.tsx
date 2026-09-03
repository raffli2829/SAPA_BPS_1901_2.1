'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, EmptyState } from '@/components/ui';
import { DatasetRepo, RecordRepo, subscribe } from '@/lib/repository';
import { Dataset, DataRecord, DataStatus } from '@/lib/types';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Database,
} from 'lucide-react';

interface DataIssue {
  id: string;
  datasetId: string;
  datasetName: string;
  datasetCode: string;
  type: 'EMPTY_DATASET' | 'OUTLIER_CHANGE' | 'DUPLICATE_PERIOD' | 'UNREVIEWED_DRAFT';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  actionHref: string;
  actionLabel: string;
}

export default function IssuesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    try {
      return DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED);
    } catch {
      return [];
    }
  });
  const [allRecords, setAllRecords] = useState<DataRecord[]>(() => {
    try {
      return RecordRepo.getAll();
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

    function loadData() {
      const ds = DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED);
      setDatasets(ds);
      setAllRecords(RecordRepo.getAll());
    }

    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  // Intelligent diagnostic analysis
  const issues = useMemo(() => {
    const list: DataIssue[] = [];

    datasets.forEach((ds) => {
      const records = allRecords.filter((r) => r.dataset_id === ds.id);

      // 1. Check for empty dataset
      if (records.length === 0) {
        list.push({
          id: `empty-${ds.id}`,
          datasetId: ds.id,
          datasetName: ds.name,
          datasetCode: ds.code,
          type: 'EMPTY_DATASET',
          severity: 'medium',
          title: 'Dataset Belum Memiliki Baris Data',
          description: `Dataset "${ds.name}" telah dibuat tetapi belum memiliki data angka statistik.`,
          recommendation: 'Lakukan input data manual atau import dari file Excel.',
          actionHref: `/input?dataset=${ds.id}`,
          actionLabel: 'Input Data',
        });
      }

      // 2. Check for duplicate periods in same dataset
      const periodMap = new Map<string, number>();
      records.forEach((r) => {
        const key = `${r.indicator}-${r.region}-${r.period}`;
        periodMap.set(key, (periodMap.get(key) || 0) + 1);
      });

      periodMap.forEach((count, key) => {
        if (count > 1) {
          list.push({
            id: `dup-${ds.id}-${key}`,
            datasetId: ds.id,
            datasetName: ds.name,
            datasetCode: ds.code,
            type: 'DUPLICATE_PERIOD',
            severity: 'high',
            title: `Duplikasi Periode Data Terdeteksi (${key})`,
            description: `Terdapat ${count} entri data pada periode yang sama untuk ${key}.`,
            recommendation: 'Periksa data di tabel dataset dan hapus atau perbarui baris yang duplikat.',
            actionHref: `/datasets/${ds.id}`,
            actionLabel: 'Buka Dataset',
          });
        }
      });

      // 3. Check for steep trend / potential outlier (> 50% year over year without notes)
      const sortedRecords = [...records]
        .filter((r) => r.value !== null && !isNaN(r.value))
        .sort((a, b) => a.period.localeCompare(b.period));

      for (let i = 1; i < sortedRecords.length; i++) {
        const prev = sortedRecords[i - 1].value;
        const curr = sortedRecords[i].value;
        if (prev !== null && curr !== null && prev !== 0) {
          const changePercent = Math.abs((curr - prev) / prev) * 100;
          if (changePercent > 60 && !sortedRecords[i].notes) {
            list.push({
              id: `outlier-${sortedRecords[i].id}`,
              datasetId: ds.id,
              datasetName: ds.name,
              datasetCode: ds.code,
              type: 'OUTLIER_CHANGE',
              severity: 'medium',
              title: `Lonjakan Nilai Signifikan (${changePercent.toFixed(1)}%) pada Periode ${sortedRecords[i].period}`,
              description: `Nilai berubah dari ${prev} menjadi ${curr} tanpa adanya catatan penjelasan metodologi.`,
              recommendation: 'Tambahkan catatan penjelasan metodologi/sumber atau periksa kebenaran nilai angka.',
              actionHref: `/datasets/${ds.id}`,
              actionLabel: 'Tinjau Nilai',
            });
          }
        }
      }

      // 4. Check for draft dataset with multiple records awaiting review
      if (ds.status === DataStatus.DRAFT && records.length >= 3) {
        list.push({
          id: `draft-ready-${ds.id}`,
          datasetId: ds.id,
          datasetName: ds.name,
          datasetCode: ds.code,
          type: 'UNREVIEWED_DRAFT',
          severity: 'low',
          title: 'Dataset Draf Siap Diajukan Review',
          description: `Dataset telah memiliki ${records.length} data statistik lengkap namun masih berstatus draf.`,
          recommendation: 'Ajukan dataset ke reviewer untuk dipublikasikan secara resmi.',
          actionHref: `/datasets/${ds.id}`,
          actionLabel: 'Ajukan Review',
        });
      }
    });

    return list;
  }, [datasets, allRecords]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent issues={issues} totalDatasets={datasets.length} />
    </AppLayout>
  );
}

function PageContent({
  issues,
  totalDatasets,
  onMobileMenuOpen,
}: {
  issues: DataIssue[];
  totalDatasets: number;
  onMobileMenuOpen?: () => void;
}) {
  const highSeverity = issues.filter((i) => i.severity === 'high');
  const mediumSeverity = issues.filter((i) => i.severity === 'medium');
  const lowSeverity = issues.filter((i) => i.severity === 'low');

  return (
    <>
      <Header
        title="Diagnostik Kualitas Data"
        subtitle="Pemeriksaan otomatis inkonsistensi, anomali angka, dan kelengkapan dataset"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />

      <div className="page-content" style={{ maxWidth: 1080 }}>
        {/* Quality Health Overview Bar */}
        <div
          style={{
            background: issues.length === 0 ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' : '#ffffff',
            border: issues.length === 0 ? 'none' : '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px 28px',
            marginBottom: 24,
            color: issues.length === 0 ? '#ffffff' : 'var(--slate-800)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                background: issues.length === 0 ? 'rgba(255,255,255,0.2)' : '#fef3c7',
                color: issues.length === 0 ? '#ffffff' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {issues.length === 0 ? <ShieldCheck size={28} /> : <AlertTriangle size={26} />}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: '0 0 4px',
                  color: issues.length === 0 ? '#ffffff' : '#0f172a',
                }}
              >
                {issues.length === 0
                  ? 'Status Data: 100% Sehat & Valid'
                  : `Ditemukan ${issues.length} Item yang Memerlukan Perhatian`}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: issues.length === 0 ? 'rgba(255,255,255,0.85)' : '#64748b',
                }}
              >
                {issues.length === 0
                  ? `Seluruh ${totalDatasets} dataset statistik makro berada dalam kondisi baik tanpa anomali.`
                  : 'Sistem mendeteksi catatan kelengkapan atau potensi anomali nilai pada dataset berikut.'}
              </p>
            </div>
          </div>

          {issues.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {highSeverity.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontWeight: 600,
                    border: '1px solid #fecaca',
                  }}
                >
                  {highSeverity.length} Kritis
                </span>
              )}
              {mediumSeverity.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: '#fffbeb',
                    color: '#b45309',
                    fontWeight: 600,
                    border: '1px solid #fde68a',
                  }}
                >
                  {mediumSeverity.length} Perhatian
                </span>
              )}
              {lowSeverity.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {lowSeverity.length} Saran
                </span>
              )}
            </div>
          )}
        </div>

        {/* Issues List */}
        {issues.length === 0 ? (
          <div className="section">
            <EmptyState
              icon={<CheckCircle2 size={42} style={{ color: '#10b981' }} />}
              title="Semua Dataset Terverifikasi Bersih"
              description="Tidak ada duplikasi, anomali nilai curam, ataupun dataset kosong yang terdeteksi saat ini."
              actions={
                <Link href="/datasets">
                  <Button variant="secondary" icon={<Database size={14} />}>
                    Buka Katalog Dataset
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="review-card"
                style={{
                  borderLeft:
                    issue.severity === 'high'
                      ? '4px solid #ef4444'
                      : issue.severity === 'medium'
                      ? '4px solid #f59e0b'
                      : '4px solid #3b82f6',
                }}
              >
                <div className="review-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          color: '#334155',
                          fontFamily: 'monospace',
                        }}
                      >
                        {issue.datasetCode}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                        {issue.datasetName}
                      </span>
                    </div>
                    <h4 className="review-card-title" style={{ fontSize: 14.5 }}>{issue.title}</h4>
                    <p className="review-card-desc">{issue.description}</p>
                  </div>

                  <span
                    className={`badge badge-sm ${
                      issue.severity === 'high'
                        ? 'badge-draft'
                        : issue.severity === 'medium'
                        ? 'badge-review'
                        : 'badge-draft'
                    }`}
                  >
                    <span className="badge-dot" />
                    {issue.severity === 'high'
                      ? 'Prioritas Tinggi'
                      : issue.severity === 'medium'
                      ? 'Perlu Dicek'
                      : 'Saran'}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#f8fafc',
                    fontSize: 12.5,
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <strong>💡 Rekomendasi Tindakan:</strong> {issue.recommendation}
                </div>

                <div className="review-card-actions">
                  <Link href={issue.actionHref}>
                    <Button variant="primary" size="sm" icon={<ArrowRight size={13} />}>
                      {issue.actionLabel}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
