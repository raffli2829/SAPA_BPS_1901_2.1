'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, InputField, TextareaField, Select, Toast } from '@/components/ui';
import { DatasetRepo } from '@/lib/repository';
import { CATEGORIES } from '@/lib/mock-data';
import { DataStatus, PeriodType } from '@/lib/types';
import { Database, Sparkles } from 'lucide-react';

export default function NewDatasetPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    definition: '',
    geographic_scope: 'Kabupaten Bangka',
    unit: '',
    source: 'BPS Kabupaten Bangka',
    period_type: PeriodType.YEARLY,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nama dataset wajib diisi.';
    if (!form.code.trim()) errs.code = 'Kode dataset wajib diisi.';
    if (!form.category) errs.category = 'Kategori wajib dipilih.';
    if (!form.unit.trim()) errs.unit = 'Satuan wajib diisi.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !user) return;

    setSaving(true);
    try {
      const dataset = DatasetRepo.create(
        {
          ...form,
          status: DataStatus.DRAFT,
        },
        user.id,
        user.name
      );
      setToast({ msg: 'Dataset berhasil dibuat.', type: 'success' });
      setTimeout(() => router.push(`/datasets/${dataset.id}`), 800);
    } catch {
      setToast({ msg: 'Gagal membuat dataset. Coba lagi.', type: 'error' });
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <PageContent
        form={form}
        errors={errors}
        saving={saving}
        onUpdateField={updateField}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/datasets')}
      />
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}

function PageContent({
  form,
  errors,
  saving,
  onUpdateField,
  onSubmit,
  onCancel,
  onMobileMenuOpen,
}: {
  form: Record<string, string>;
  errors: Record<string, string>;
  saving: boolean;
  onUpdateField: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Buat Dataset Baru"
        subtitle="Daftarkan indikator makro baru ke dalam sistem"
        backHref="/datasets"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 960 }}>
        <div className="section">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <Database size={18} style={{ color: '#2563eb' }} />
                Informasi Pokok Dataset
              </h2>
              <p className="section-subtitle">
                Isi rincian nama, kode unik, kategori, dan satuan data statistik
              </p>
            </div>
          </div>
          <div className="section-body">
            <form onSubmit={onSubmit}>
              <div className="form-grid">
                <InputField
                  label="Nama Dataset"
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => onUpdateField('name', e.target.value)}
                  error={errors.name}
                  placeholder="Contoh: Jumlah Penduduk Kabupaten Bangka"
                />
                <InputField
                  label="Kode Dataset"
                  id="code"
                  required
                  value={form.code}
                  onChange={(e) => onUpdateField('code', e.target.value.toUpperCase())}
                  error={errors.code}
                  placeholder="Contoh: POP-001"
                  hint="Gunakan format huruf kapital dan strip (contoh: PDRB-001)"
                />
                <Select
                  label="Kategori Statistik"
                  options={CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Pilih kategori statistik"
                  value={form.category}
                  onChange={(e) => onUpdateField('category', e.target.value)}
                  error={errors.category}
                />
                <InputField
                  label="Satuan Nilai"
                  id="unit"
                  required
                  value={form.unit}
                  onChange={(e) => onUpdateField('unit', e.target.value)}
                  error={errors.unit}
                  placeholder="Contoh: Jiwa, Persen (%), Miliar Rupiah"
                />
                <InputField
                  label="Cakupan Wilayah"
                  id="geographic_scope"
                  value={form.geographic_scope}
                  onChange={(e) => onUpdateField('geographic_scope', e.target.value)}
                  placeholder="Kabupaten Bangka"
                />
                <InputField
                  label="Sumber Data"
                  id="source"
                  value={form.source}
                  onChange={(e) => onUpdateField('source', e.target.value)}
                  placeholder="BPS Kabupaten Bangka"
                />
                <Select
                  label="Tipe Frekuensi Periode"
                  options={[
                    { value: PeriodType.YEARLY, label: 'Tahunan (Yearly)' },
                    { value: PeriodType.QUARTERLY, label: 'Triwulanan (Quarterly)' },
                    { value: PeriodType.MONTHLY, label: 'Bulanan (Monthly)' },
                  ]}
                  value={form.period_type}
                  onChange={(e) => onUpdateField('period_type', e.target.value)}
                />
                <div className="form-grid-full">
                  <TextareaField
                    label="Deskripsi Dataset"
                    id="description"
                    value={form.description}
                    onChange={(e) => onUpdateField('description', e.target.value)}
                    placeholder="Jelaskan secara singkat cakupan dan tujuan dataset ini"
                    rows={3}
                  />
                </div>
                <div className="form-grid-full">
                  <TextareaField
                    label="Definisi Operasional / Konsep"
                    id="definition"
                    value={form.definition}
                    onChange={(e) => onUpdateField('definition', e.target.value)}
                    placeholder="Definisi teknis indikator berdasarkan metodologi BPS"
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-actions">
                <Button variant="secondary" type="button" onClick={onCancel}>
                  Batal
                </Button>
                <Button type="submit" loading={saving} icon={<Sparkles size={14} />}>
                  Simpan Dataset Baru
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
