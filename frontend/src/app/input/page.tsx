'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  InputField,
  Select,
  Toast,
  EmptyState,
  Modal,
} from '@/components/ui';
import {
  DatasetRepo,
  RecordRepo,
  validateRecord,
  subscribe,
} from '@/lib/repository';
import {
  Dataset,
  DataRecord,
  DataStatus,
  InputMode,
  ValidationError,
  AnomalyWarning,
} from '@/lib/types';
import { generateId, parseTabSeparated } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Save,
  Undo2,
  Clipboard,
  Layers,
  Table as TableIcon,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

function InputPageContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDataset = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(preselectedDataset || '');
  const [mode, setMode] = useState<InputMode>('form');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [anomalyWarning, setAnomalyWarning] = useState<AnomalyWarning | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      const all = DatasetRepo.getAll().filter(
        (d) => d.status !== DataStatus.ARCHIVED
      );
      setDatasets(all);
    }

    loadData();
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        selectedDataset={selectedDataset || null}
        onSelectDataset={setSelectedDatasetId}
        mode={mode}
        onModeChange={setMode}
        user={user}
        toast={toast}
        setToast={setToast}
        anomalyWarning={anomalyWarning}
        setAnomalyWarning={setAnomalyWarning}
      />
    </AppLayout>
  );
}

export default function InputPage() {
  return (
    <Suspense>
      <InputPageContent />
    </Suspense>
  );
}

function PageContent({
  datasets,
  selectedDatasetId,
  selectedDataset,
  onSelectDataset,
  mode,
  onModeChange,
  user,
  toast,
  setToast,
  anomalyWarning,
  setAnomalyWarning,
  onMobileMenuOpen,
}: {
  datasets: Dataset[];
  selectedDatasetId: string;
  selectedDataset: Dataset | null;
  onSelectDataset: (id: string) => void;
  mode: InputMode;
  onModeChange: (m: InputMode) => void;
  user: { id: string; name: string } | null;
  toast: { msg: string; type: 'success' | 'error' | 'warning' } | null;
  setToast: (t: { msg: string; type: 'success' | 'error' | 'warning' } | null) => void;
  anomalyWarning: AnomalyWarning | null;
  setAnomalyWarning: (w: AnomalyWarning | null) => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Input Data Statistik"
        subtitle="Entri data makro secara cepat atau melalui spreadsheet"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content">
        {/* Top bar: Dataset selector + Mode Switcher */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          <div style={{ minWidth: 280, flex: 1, maxWidth: 440 }}>
            <Select
              label="Pilih Dataset Target"
              options={datasets.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.code})`,
              }))}
              placeholder="-- Pilih dataset tujuan input --"
              value={selectedDatasetId}
              onChange={(e) => onSelectDataset(e.target.value)}
            />
          </div>

          {selectedDataset && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <span className="input-label">Metode Pengisian</span>
              <div className="mode-selector">
                <button
                  type="button"
                  className={`mode-selector-btn ${mode === 'form' ? 'mode-selector-btn-active' : ''}`}
                  onClick={() => onModeChange('form')}
                >
                  <FileText size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                  Formulir Cepat
                </button>
                <button
                  type="button"
                  className={`mode-selector-btn ${mode === 'spreadsheet' ? 'mode-selector-btn-active' : ''}`}
                  onClick={() => onModeChange('spreadsheet')}
                >
                  <TableIcon size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                  Grid Spreadsheet
                </button>
              </div>
            </div>
          )}
        </div>

        {!selectedDataset ? (
          <div className="section">
            <EmptyState
              icon={<Layers size={40} />}
              title="Pilih Dataset Terlebih Dahulu"
              description="Pilih salah satu dataset pada dropdown di atas untuk memulai pengisian data statistik."
            />
          </div>
        ) : (
          <>
            {mode === 'form' ? (
              <QuickForm
                key={selectedDataset.id}
                dataset={selectedDataset}
                user={user}
                setToast={setToast}
                setAnomalyWarning={setAnomalyWarning}
              />
            ) : (
              <SpreadsheetEditor
                key={selectedDataset.id}
                dataset={selectedDataset}
                user={user}
                setToast={setToast}
              />
            )}
          </>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {anomalyWarning && (
        <Modal
          open={true}
          onClose={() => setAnomalyWarning(null)}
          title="Peringatan Validasi Anomali Data"
          variant="warning"
          description={anomalyWarning.message}
          actions={
            <>
              <Button variant="secondary" onClick={() => setAnomalyWarning(null)}>
                Periksa Ulang
              </Button>
              <Button
                variant="primary"
                onClick={() => setAnomalyWarning(null)}
              >
                Tetap Lanjutkan
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

// ============================================================
// QUICK FORM — Mode 1
// ============================================================

function QuickForm({
  dataset,
  user,
  setToast,
  setAnomalyWarning,
}: {
  dataset: Dataset;
  user: { id: string; name: string } | null;
  setToast: (t: { msg: string; type: 'success' | 'error' | 'warning' } | null) => void;
  setAnomalyWarning: (w: AnomalyWarning | null) => void;
}) {
  const [form, setForm] = useState({
    indicator: dataset.name,
    region: dataset.geographic_scope,
    period: '',
    value: '',
    unit: dataset.unit,
    notes: '',
    source: dataset.source,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const periodRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numValue = form.value ? parseFloat(form.value.replace(/\./g, '').replace(',', '.')) : null;

    const recordData: Partial<DataRecord> = {
      indicator: form.indicator,
      region: form.region,
      period: form.period,
      value: numValue,
      unit: form.unit,
    };

    const validationErrors = validateRecord(recordData, dataset.id);
    const fieldErrors: Record<string, string> = {};
    const warnings: ValidationError[] = [];

    validationErrors.forEach((err) => {
      if (err.severity === 'error') {
        fieldErrors[err.field] = err.message;
      } else {
        warnings.push(err);
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    if (numValue !== null) {
      const anomaly = RecordRepo.checkAnomalies(
        dataset.id,
        form.indicator,
        form.region,
        numValue
      );
      if (anomaly) {
        setAnomalyWarning(anomaly);
      }
    }

    setSaving(true);
    try {
      RecordRepo.create(
        {
          dataset_id: dataset.id,
          indicator: form.indicator,
          region: form.region,
          period: form.period,
          value: numValue,
          unit: form.unit,
          notes: form.notes,
          source: form.source,
          status: DataStatus.DRAFT,
          created_by: user.id,
          updated_by: user.id,
        },
        user.name
      );

      setToast({ msg: `Data ${form.indicator} (${form.period}) berhasil disimpan.`, type: 'success' });

      setForm((prev) => ({
        ...prev,
        period: '',
        value: '',
        notes: '',
      }));
      setErrors({});

      setTimeout(() => periodRef.current?.focus(), 100);
    } catch {
      setToast({ msg: 'Gagal menyimpan data. Silakan coba lagi.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section" style={{ maxWidth: 860 }}>
      <div className="section-header">
        <div>
          <h3 className="section-title">
            <Sparkles size={16} style={{ color: '#2563eb' }} />
            Formulir Entri Data Cepat
          </h3>
          <p className="section-subtitle">
            Masukkan data angka statistik per tahun/periode untuk dataset <strong>{dataset.name}</strong>
          </p>
        </div>
      </div>
      <div className="section-body">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <InputField
              label="Nama Indikator"
              id="indicator"
              required
              value={form.indicator}
              onChange={(e) => {
                setForm((p) => ({ ...p, indicator: e.target.value }));
                if (errors.indicator) setErrors((p) => { const n = { ...p }; delete n.indicator; return n; });
              }}
              error={errors.indicator}
            />
            <InputField
              label="Wilayah"
              id="region"
              required
              value={form.region}
              onChange={(e) => {
                setForm((p) => ({ ...p, region: e.target.value }));
                if (errors.region) setErrors((p) => { const n = { ...p }; delete n.region; return n; });
              }}
              error={errors.region}
            />
            <InputField
              label="Periode / Tahun"
              id="period"
              required
              ref={periodRef}
              value={form.period}
              onChange={(e) => {
                setForm((p) => ({ ...p, period: e.target.value }));
                if (errors.period) setErrors((p) => { const n = { ...p }; delete n.period; return n; });
              }}
              error={errors.period}
              placeholder="Contoh: 2025"
              hint="Format tahun (2025), triwulan (2025-Q1), atau bulan (2025-01)"
            />
            <InputField
              label={`Nilai Angka (${form.unit || 'Satuan'})`}
              id="value"
              required
              value={form.value}
              onChange={(e) => {
                setForm((p) => ({ ...p, value: e.target.value }));
                if (errors.value) setErrors((p) => { const n = { ...p }; delete n.value; return n; });
              }}
              error={errors.value}
              placeholder="Contoh: 320500 atau 78.45"
            />
            <InputField
              label="Satuan Nilai"
              id="unit"
              required
              value={form.unit}
              onChange={(e) => {
                setForm((p) => ({ ...p, unit: e.target.value }));
                if (errors.unit) setErrors((p) => { const n = { ...p }; delete n.unit; return n; });
              }}
              error={errors.unit}
            />
            <InputField
              label="Sumber Data"
              id="source"
              value={form.source}
              onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
            />
            <div className="form-grid-full">
              <InputField
                label="Catatan Metodologi / Keterangan Tambahan"
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Misal: Angka Sementara, Angka Sangat Sementara, atau Revisi"
              />
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit" loading={saving} icon={<Save size={14} />}>
              Simpan & Tambah Data Berikutnya
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// SPREADSHEET EDITOR — Mode 2
// ============================================================

interface SpreadsheetRowData {
  id: string;
  indicator: string;
  region: string;
  period: string;
  value: string;
  unit: string;
  notes: string;
  errors: Record<string, string>;
  isNew: boolean;
  [key: string]: string | boolean | Record<string, string> | undefined;
}

function createEmptyRow(ds: Dataset): SpreadsheetRowData {
  return {
    id: generateId(),
    indicator: ds.name,
    region: ds.geographic_scope,
    period: '',
    value: '',
    unit: ds.unit,
    notes: '',
    errors: {},
    isNew: true,
  };
}

function SpreadsheetEditor({
  dataset,
  user,
  setToast,
}: {
  dataset: Dataset;
  user: { id: string; name: string } | null;
  setToast: (t: { msg: string; type: 'success' | 'error' | 'warning' } | null) => void;
}) {
  const [rows, setRows] = useState<SpreadsheetRowData[]>([
    createEmptyRow(dataset),
  ]);
  const [history, setHistory] = useState<SpreadsheetRowData[][]>([]);
  const [saving, setSaving] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<string[][] | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-20), rows.map((r) => ({ ...r }))]);
  };

  const addRow = () => {
    pushHistory();
    setRows((prev) => [...prev, createEmptyRow(dataset)]);
  };

  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    pushHistory();
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCell = (index: number, field: keyof SpreadsheetRowData, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        if (updated.errors[field]) {
          const newErrors = { ...updated.errors };
          delete newErrors[field];
          updated.errors = newErrors;
        }
        return updated;
      })
    );
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRows(prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const cols = ['indicator', 'region', 'period', 'value', 'unit', 'notes'];

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
      if (nextCol >= 0 && nextCol < cols.length) {
        focusCell(rowIndex, nextCol);
      } else if (nextCol >= cols.length && rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, 0);
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, colIndex);
      } else {
        addRow();
        setTimeout(() => focusCell(rowIndex + 1, colIndex), 50);
      }
    }

    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }

    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const focusCell = (row: number, col: number) => {
    const input = tableRef.current?.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    ) as HTMLInputElement;
    input?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent, rowIndex: number, colIndex: number) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\t') || text.includes('\n')) {
      e.preventDefault();
      pushHistory();

      const parsed = parseTabSeparated(text);
      const cols = ['indicator', 'region', 'period', 'value', 'unit', 'notes'];
      const newRows = [...rows];

      parsed.forEach((rowData, i) => {
        const targetRow = rowIndex + i;
        if (targetRow >= newRows.length) {
          newRows.push(createEmptyRow(dataset));
        }
        rowData.forEach((cellValue, j) => {
          const targetCol = colIndex + j;
          if (targetCol < cols.length) {
            newRows[targetRow][cols[targetCol]] = cellValue;
          }
        });
      });

      setRows(newRows);
      setToast({
        msg: `${parsed.length} baris data berhasil ditempel.`,
        type: 'success',
      });
    }
  };

  const handlePasteDialog = () => {
    if (!pasteText.trim()) return;
    const parsed = parseTabSeparated(pasteText);
    setPastePreview(parsed);
  };

  const confirmPaste = () => {
    if (!pastePreview) return;
    pushHistory();

    const newRows: SpreadsheetRowData[] = pastePreview.map((rowData) => {
      const row = createEmptyRow(dataset);
      if (rowData.length >= 2) {
        row.period = rowData[0];
        row.value = rowData[1];
      }
      if (rowData.length >= 3) row.region = rowData[2];
      if (rowData.length >= 4) row.unit = rowData[3];
      return row;
    });

    setRows((prev) => {
      const filtered = prev.filter((r) => r.period || r.value);
      return [...filtered, ...newRows];
    });

    setShowPaste(false);
    setPasteText('');
    setPastePreview(null);
    setToast({ msg: `${newRows.length} baris data berhasil ditambahkan ke tabel.`, type: 'success' });
  };

  const handleSave = () => {
    if (!user) return;

    let hasErrors = false;
    const validatedRows = rows.map((row) => {
      if (!row.period && !row.value) return row;

      const numValue = row.value ? parseFloat(row.value.replace(/\./g, '').replace(',', '.')) : null;
      const errs = validateRecord(
        {
          indicator: row.indicator,
          region: row.region,
          period: row.period,
          value: numValue,
          unit: row.unit,
        },
        dataset.id
      );

      const fieldErrors: Record<string, string> = {};
      errs
        .filter((e) => e.severity === 'error')
        .forEach((e) => {
          fieldErrors[e.field] = e.message;
          hasErrors = true;
        });

      return { ...row, errors: fieldErrors };
    });

    setRows(validatedRows);

    if (hasErrors) {
      setToast({ msg: 'Ada sel data yang tidak valid. Periksa sel berwarna merah.', type: 'error' });
      return;
    }

    const toSave = validatedRows.filter((r) => r.period || r.value);
    if (toSave.length === 0) {
      setToast({ msg: 'Tabel masih kosong. Isi periode dan nilai sebelum menyimpan.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const records = toSave.map((row) => ({
        dataset_id: dataset.id,
        indicator: row.indicator,
        region: row.region,
        period: row.period,
        value: row.value ? parseFloat(row.value.replace(/\./g, '').replace(',', '.')) : null,
        unit: row.unit,
        notes: row.notes,
        source: dataset.source,
        status: DataStatus.DRAFT,
        created_by: user.id,
        updated_by: user.id,
      }));

      RecordRepo.createBulk(records, user.name);
      setToast({ msg: `${records.length} data berhasil disimpan secara massal!`, type: 'success' });
      setRows([createEmptyRow(dataset)]);
      setHistory([]);
    } catch {
      setToast({ msg: 'Gagal menyimpan data spreadsheet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const cols = [
    { key: 'indicator', label: 'Indikator', width: '200px' },
    { key: 'region', label: 'Wilayah', width: '150px' },
    { key: 'period', label: 'Periode (Tahun)', width: '110px' },
    { key: 'value', label: `Nilai (${dataset.unit})`, width: '130px' },
    { key: 'unit', label: 'Satuan', width: '100px' },
    { key: 'notes', label: 'Catatan', width: '160px' },
  ];

  const nonEmptyCount = rows.filter((r) => r.period || r.value).length;

  return (
    <>
      <div className="spreadsheet-wrapper">
        <div className="spreadsheet-toolbar">
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={addRow}
            >
              Tambah Baris
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Clipboard size={14} />}
              onClick={() => setShowPaste(true)}
            >
              Tempel dari Excel (Paste)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Undo2 size={14} />}
              onClick={handleUndo}
              disabled={history.length === 0}
            >
              Undo
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              {nonEmptyCount} baris terisi
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={14} />}
              onClick={handleSave}
              loading={saving}
              disabled={nonEmptyCount === 0}
            >
              Simpan Semua Baris
            </Button>
          </div>
        </div>

        <div className="spreadsheet-table-wrapper">
          <table className="spreadsheet-table" ref={tableRef}>
            <thead>
              <tr>
                <th style={{ width: '44px', textAlign: 'center' }}>#</th>
                {cols.map((col) => (
                  <th key={col.key} style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
                <th style={{ width: '44px', textAlign: 'center' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id}>
                  <td className="spreadsheet-row-number">{rowIndex + 1}</td>
                  {cols.map((col, colIndex) => (
                    <td key={col.key}>
                      <input
                        className={`spreadsheet-cell ${
                          row.errors[col.key] ? 'spreadsheet-cell-error' : ''
                        }`}
                        value={String(row[col.key] ?? '')}
                        onChange={(e) =>
                          updateCell(rowIndex, col.key as keyof SpreadsheetRowData, e.target.value)
                        }
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                        data-row={rowIndex}
                        data-col={colIndex}
                        title={row.errors[col.key] || ''}
                        placeholder={col.key === 'period' ? '2025' : col.key === 'value' ? '0' : ''}
                      />
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="spreadsheet-delete-btn"
                      onClick={() => deleteRow(rowIndex)}
                      disabled={rows.length <= 1}
                      title="Hapus baris ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={cols.length + 2}>
                  <button type="button" className="spreadsheet-add-row" onClick={addRow}>
                    <Plus size={14} /> Tambah baris baru
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', display: 'flex', gap: 14 }}>
        <span>💡 <strong>Tab</strong>: pindah kolom</span>
        <span>•</span>
        <span><strong>Enter</strong>: baris baru</span>
        <span>•</span>
        <span><strong>Ctrl+V</strong>: tempel data Excel</span>
        <span>•</span>
        <span><strong>Ctrl+S</strong>: simpan</span>
      </div>

      {/* Paste Dialog */}
      {showPaste && (
        <Modal
          open={true}
          onClose={() => {
            setShowPaste(false);
            setPasteText('');
            setPastePreview(null);
          }}
          title="Tempel Data dari Spreadsheet (Excel/Sheets)"
        >
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            Salin data tabel dari Excel (kolom: <strong>Tahun / Periode</strong> dan <strong>Nilai</strong>), lalu tempel di kotak berikut:
          </p>
          <textarea
            className="paste-area"
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPastePreview(null);
            }}
            placeholder={`2020\t298000\n2021\t304500\n2022\t311200\n2023\t318900\n2024\t325100`}
            rows={6}
          />
          {!pastePreview && pasteText.trim() && (
            <div style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={handlePasteDialog}>
                Pratinjau Hasil Parsing
              </Button>
            </div>
          )}
          {pastePreview && (
            <div className="paste-preview">
              <div className="paste-preview-count">
                <span className="paste-preview-valid">
                  ✓ {pastePreview.length} baris siap ditempel
                </span>
              </div>
              <div className="data-table-wrapper" style={{ maxHeight: 180 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kolom 1 (Periode)</th>
                      <th>Kolom 2 (Nilai)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastePreview.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{row[0]}</td>
                        <td>{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowPaste(false);
                setPasteText('');
                setPastePreview(null);
              }}
            >
              Batal
            </Button>
            <Button
              onClick={confirmPaste}
              disabled={!pastePreview || pastePreview.length === 0}
            >
              Masukkan {pastePreview ? `${pastePreview.length} Baris Data` : ''}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
