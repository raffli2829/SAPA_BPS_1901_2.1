// ============================================================
// SAPA BPS 1901 IN — Repository / Data Access Layer
// ============================================================
// Mock implementation using in-memory storage.
// Replace with real database calls when ready.
// ============================================================

import {
  Dataset,
  DataRecord,
  DataStatus,
  AuditLog,
  AuditAction,
  AuditChange,
  User,
  ReviewRequest,
  DashboardSummary,
  Category,
  ValidationError,
  AnomalyWarning,
} from './types';
import {
  MOCK_DATASETS,
  MOCK_RECORDS,
  MOCK_USERS,
  MOCK_REVIEWS,
  MOCK_AUDIT_LOGS,
  CATEGORIES,
} from './mock-data';
import { generateId, detectChangeAnomaly } from './utils';
import { BackendApi } from './apiClient';

// --- In-Memory Store ---

const STORAGE_KEY = 'sapa_bps_data';

interface AppStore {
  datasets: Dataset[];
  records: DataRecord[];
  users: User[];
  reviews: ReviewRequest[];
  auditLogs: AuditLog[];
  categories: Category[];
}

function getInitialStore(): AppStore {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore parse errors
    }
  }
  return {
    datasets: [...MOCK_DATASETS],
    records: [...MOCK_RECORDS],
    users: [...MOCK_USERS],
    reviews: [...MOCK_REVIEWS],
    auditLogs: [...MOCK_AUDIT_LOGS],
    categories: [...CATEGORIES],
  };
}

let store: AppStore | null = null;

function getStore(): AppStore {
  if (!store) {
    store = getInitialStore();
  }
  return store;
}

function saveStore(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getStore()));
    } catch {
      // localStorage full or unavailable
    }
  }
}

// Notify listeners
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  saveStore();
  listeners.forEach((l) => l());
}

let isSyncing = false;

/**
 * Sinkronisasi data real-time dengan backend Express (Port 8000)
 */
export async function syncWithBackend(): Promise<void> {
  if (typeof window === 'undefined' || isSyncing) return;
  isSyncing = true;

  try {
    const [datasets, records, reviews, auditLogs, users, categories] = await Promise.all([
      BackendApi.getDatasets(),
      BackendApi.getRecords(),
      BackendApi.getReviews(),
      BackendApi.getAuditLogs(),
      BackendApi.getUsers(),
      BackendApi.getCategories(),
    ]);

    const s = getStore();
    let hasChanges = false;

    if (datasets && datasets.length > 0) {
      s.datasets = datasets;
      hasChanges = true;
    }
    if (records && records.length > 0) {
      s.records = records;
      hasChanges = true;
    }
    if (reviews && reviews.length > 0) {
      s.reviews = reviews;
      hasChanges = true;
    }
    if (auditLogs && auditLogs.length > 0) {
      s.auditLogs = auditLogs;
      hasChanges = true;
    }
    if (users && users.length > 0) {
      s.users = users;
      hasChanges = true;
    }
    if (categories && categories.length > 0) {
      s.categories = categories;
      hasChanges = true;
    }

    if (hasChanges) {
      notify();
    }
  } catch {
    // backend offline fallback to local store
  } finally {
    isSyncing = false;
  }
}

// Auto sync on client initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncWithBackend();
  }, 100);
}

// --- Reset ---

export function resetStore(): void {
  store = {
    datasets: [...MOCK_DATASETS],
    records: [...MOCK_RECORDS],
    users: [...MOCK_USERS],
    reviews: [...MOCK_REVIEWS],
    auditLogs: [...MOCK_AUDIT_LOGS],
    categories: [...CATEGORIES],
  };
  saveStore();
  notify();
}

// ============================================================
// CATEGORY REPOSITORY
// ============================================================

export const CategoryRepo = {
  getAll(): Category[] {
    return getStore().categories;
  },

  getById(id: string): Category | undefined {
    return getStore().categories.find((c) => c.id === id);
  },

  getByName(name: string): Category | undefined {
    return getStore().categories.find((c) => c.name === name);
  },

  create(data: Omit<Category, 'id'>): Category {
    const category: Category = { id: generateId(), ...data };
    getStore().categories.push(category);
    notify();
    return category;
  },
};

// ============================================================
// DATASET REPOSITORY
// ============================================================

export const DatasetRepo = {
  getAll(): Dataset[] {
    return getStore().datasets.map((ds) => ({
      ...ds,
      record_count: getStore().records.filter(
        (r) => r.dataset_id === ds.id && !r.is_deleted
      ).length,
    }));
  },

  getById(id: string): Dataset | undefined {
    const ds = getStore().datasets.find((d) => d.id === id);
    if (!ds) return undefined;
    return {
      ...ds,
      record_count: getStore().records.filter(
        (r) => r.dataset_id === ds.id && !r.is_deleted
      ).length,
    };
  },

  getPublished(): Dataset[] {
    return this.getAll().filter((d) => d.status === DataStatus.PUBLISHED);
  },

  search(query: string): Dataset[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.geographic_scope.toLowerCase().includes(q)
    );
  },

  create(
    data: Omit<Dataset, 'id' | 'created_at' | 'updated_at' | 'record_count' | 'created_by' | 'updated_by'>,
    userId: string,
    userName: string
  ): Dataset {
    const now = new Date().toISOString();
    const dataset: Dataset = {
      id: generateId(),
      ...data,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    };
    getStore().datasets.push(dataset);

    // Audit log
    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: dataset.id,
      entity_name: dataset.name,
      action: AuditAction.CREATE,
      changes: [],
      user_id: userId,
      user_name: userName,
    });

    BackendApi.createDataset(dataset).catch(() => {});
    notify();
    return dataset;
  },

  update(
    id: string,
    updates: Partial<Dataset>,
    userId: string,
    userName: string
  ): Dataset | undefined {
    const s = getStore();
    const index = s.datasets.findIndex((d) => d.id === id);
    if (index === -1) return undefined;

    const old = s.datasets[index];
    const changes: AuditChange[] = [];

    for (const key of Object.keys(updates) as (keyof Dataset)[]) {
      if (updates[key] !== old[key]) {
        changes.push({
          field: key,
          old_value: old[key] as string | number | null,
          new_value: updates[key] as string | number | null,
        });
      }
    }

    s.datasets[index] = {
      ...old,
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (changes.length > 0) {
      AuditRepo.log({
        entity_type: 'dataset',
        entity_id: id,
        entity_name: s.datasets[index].name,
        action: AuditAction.UPDATE,
        changes,
        user_id: userId,
        user_name: userName,
      });
    }

    BackendApi.updateDataset(id, updates).catch(() => {});
    notify();
    return s.datasets[index];
  },

  updateStatus(
    id: string,
    status: DataStatus,
    userId: string,
    userName: string,
    reason?: string
  ): Dataset | undefined {
    const s = getStore();
    const index = s.datasets.findIndex((d) => d.id === id);
    if (index === -1) return undefined;

    const old = s.datasets[index];
    const actionMap: Record<string, AuditAction> = {
      [`${DataStatus.DRAFT}_${DataStatus.REVIEW}`]: AuditAction.SUBMIT_REVIEW,
      [`${DataStatus.REVIEW}_${DataStatus.PUBLISHED}`]: AuditAction.APPROVE,
      [`${DataStatus.REVIEW}_${DataStatus.DRAFT}`]: AuditAction.REJECT,
      [`${DataStatus.PUBLISHED}_${DataStatus.ARCHIVED}`]: AuditAction.ARCHIVE,
    };

    const action =
      actionMap[`${old.status}_${status}`] || AuditAction.STATUS_CHANGE;

    s.datasets[index] = {
      ...old,
      status,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    // Also update records status if publishing/archiving
    if (status === DataStatus.PUBLISHED || status === DataStatus.ARCHIVED) {
      s.records
        .filter((r) => r.dataset_id === id && !r.is_deleted)
        .forEach((r) => {
          r.status = status;
          r.updated_by = userId;
          r.updated_at = new Date().toISOString();
        });
    }

    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: id,
      entity_name: s.datasets[index].name,
      action,
      changes: [
        { field: 'status', old_value: old.status, new_value: status },
      ],
      user_id: userId,
      user_name: userName,
      reason,
    });

    BackendApi.updateDataset(id, { status }).catch(() => {});
    notify();
    return s.datasets[index];
  },

  delete(id: string, userId: string, userName: string): boolean {
    const s = getStore();
    const dataset = s.datasets.find((d) => d.id === id);
    if (!dataset) return false;

    // Soft delete: archive
    dataset.status = DataStatus.ARCHIVED;
    dataset.updated_by = userId;
    dataset.updated_at = new Date().toISOString();

    // Soft delete records
    s.records
      .filter((r) => r.dataset_id === id)
      .forEach((r) => {
        r.is_deleted = true;
        r.updated_by = userId;
        r.updated_at = new Date().toISOString();
      });

    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: id,
      entity_name: dataset.name,
      action: AuditAction.ARCHIVE,
      changes: [],
      user_id: userId,
      user_name: userName,
    });

    BackendApi.deleteDataset(id).catch(() => {});
    notify();
    return true;
  },
};

// ============================================================
// DATA RECORD REPOSITORY
// ============================================================

export const RecordRepo = {
  getAll(): DataRecord[] {
    return getStore()
      .records.filter((r) => !r.is_deleted)
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  getByDataset(datasetId: string): DataRecord[] {
    return getStore()
      .records.filter((r) => r.dataset_id === datasetId && !r.is_deleted)
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  getById(id: string): DataRecord | undefined {
    return getStore().records.find((r) => r.id === id && !r.is_deleted);
  },

  getByStatus(status: DataStatus): DataRecord[] {
    return getStore().records.filter(
      (r) => r.status === status && !r.is_deleted
    );
  },

  create(
    data: Omit<
      DataRecord,
      'id' | 'created_at' | 'updated_at' | 'is_deleted'
    >,
    userName: string
  ): DataRecord {
    const now = new Date().toISOString();
    const record: DataRecord = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
      is_deleted: false,
    };
    getStore().records.push(record);

    AuditRepo.log({
      entity_type: 'record',
      entity_id: record.id,
      entity_name: `${record.indicator} ${record.period}`,
      action: AuditAction.CREATE,
      changes: [{ field: 'value', old_value: null, new_value: record.value }],
      user_id: data.created_by,
      user_name: userName,
    });

    // Update dataset's updated_at
    const ds = getStore().datasets.find((d) => d.id === data.dataset_id);
    if (ds) {
      ds.updated_at = now;
      ds.updated_by = data.created_by;
    }

    BackendApi.createRecord(record).catch(() => {});
    notify();
    return record;
  },

  createBulk(
    records: Omit<
      DataRecord,
      'id' | 'created_at' | 'updated_at' | 'is_deleted'
    >[],
    userName: string
  ): DataRecord[] {
    const now = new Date().toISOString();
    const created: DataRecord[] = records.map((data) => ({
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
      is_deleted: false,
    }));

    getStore().records.push(...created);

    // Single audit log for bulk
    if (created.length > 0) {
      AuditRepo.log({
        entity_type: 'record',
        entity_id: created[0].dataset_id,
        entity_name: `${created.length} data records`,
        action: AuditAction.CREATE,
        changes: created.map((r) => ({
          field: `${r.indicator} ${r.period}`,
          old_value: null,
          new_value: r.value,
        })),
        user_id: records[0].created_by,
        user_name: userName,
      });

      // Update dataset
      const ds = getStore().datasets.find(
        (d) => d.id === created[0].dataset_id
      );
      if (ds) {
        ds.updated_at = now;
        ds.updated_by = records[0].created_by;
      }

      BackendApi.bulkSaveRecords(created[0].dataset_id, created).catch(() => {});
    }

    notify();
    return created;
  },

  update(
    id: string,
    updates: Partial<DataRecord>,
    userId: string,
    userName: string,
    reason?: string
  ): DataRecord | undefined {
    const s = getStore();
    const index = s.records.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    const old = s.records[index];
    const changes: AuditChange[] = [];

    for (const key of Object.keys(updates) as (keyof DataRecord)[]) {
      if (updates[key] !== old[key]) {
        changes.push({
          field: key,
          old_value: old[key] as string | number | null,
          new_value: updates[key] as string | number | null,
        });
      }
    }

    s.records[index] = {
      ...old,
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (changes.length > 0) {
      AuditRepo.log({
        entity_type: 'record',
        entity_id: id,
        entity_name: `${s.records[index].indicator} ${s.records[index].period}`,
        action: AuditAction.UPDATE,
        changes,
        user_id: userId,
        user_name: userName,
        reason: reason || 'Pembaruan nilai data',
      });
    }

    BackendApi.updateRecord(id, updates).catch(() => {});
    notify();
    return s.records[index];
  },

  delete(id: string, userId: string, userName: string): boolean {
    const record = getStore().records.find((r) => r.id === id);
    if (!record) return false;

    record.is_deleted = true;
    record.updated_by = userId;
    record.updated_at = new Date().toISOString();

    AuditRepo.log({
      entity_type: 'record',
      entity_id: id,
      entity_name: `${record.indicator} ${record.period}`,
      action: AuditAction.DELETE,
      changes: [{ field: 'value', old_value: record.value, new_value: null }],
      user_id: userId,
      user_name: userName,
    });

    BackendApi.deleteRecord(id).catch(() => {});
    notify();
    return true;
  },

  checkDuplicate(
    datasetId: string,
    indicator: string,
    region: string,
    period: string,
    excludeId?: string
  ): boolean {
    return getStore().records.some(
      (r) =>
        r.dataset_id === datasetId &&
        r.indicator === indicator &&
        r.region === region &&
        r.period === period &&
        !r.is_deleted &&
        r.id !== excludeId
    );
  },

  checkAnomalies(
    datasetId: string,
    indicator: string,
    region: string,
    value: number
  ): AnomalyWarning | null {
    const existing = getStore()
      .records.filter(
        (r) =>
          r.dataset_id === datasetId &&
          r.indicator === indicator &&
          r.region === region &&
          !r.is_deleted &&
          r.value !== null
      )
      .sort((a, b) => b.period.localeCompare(a.period));

    if (existing.length === 0) return null;

    const latest = existing[0];
    if (latest.value !== null && detectChangeAnomaly(value, latest.value)) {
      const changePercent =
        ((value - latest.value) / latest.value) * 100;
      return {
        record_id: latest.id,
        field: 'value',
        current_value: value,
        previous_value: latest.value,
        change_percent: changePercent,
        message: `Perubahan nilai terlihat sangat besar (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%). Periksa kembali apakah nilai ${value.toLocaleString('id-ID')} sudah benar.`,
      };
    }

    return null;
  },
};

// ============================================================
// AUDIT LOG REPOSITORY
// ============================================================

export const AuditRepo = {
  getAll(): AuditLog[] {
    return getStore().auditLogs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getByEntity(entityId: string): AuditLog[] {
    return getStore()
      .auditLogs.filter((l) => l.entity_id === entityId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  getByDataset(datasetId: string): AuditLog[] {
    // Get logs for the dataset and its records
    const recordIds = getStore()
      .records.filter((r) => r.dataset_id === datasetId)
      .map((r) => r.id);

    return getStore()
      .auditLogs.filter(
        (l) => l.entity_id === datasetId || recordIds.includes(l.entity_id)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  log(data: Omit<AuditLog, 'id' | 'created_at'> & { reason?: string }): void {
    const log: AuditLog = {
      id: generateId(),
      ...data,
      created_at: new Date().toISOString(),
    };
    getStore().auditLogs.push(log);
    BackendApi.logAudit(log).catch(() => {});
    // Don't call notify() here to avoid infinite loops
  },
};

// ============================================================
// REVIEW REPOSITORY
// ============================================================

export const ReviewRepo = {
  getAll(): ReviewRequest[] {
    return getStore().reviews.sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() -
        new Date(a.submitted_at).getTime()
    );
  },

  getPending(): ReviewRequest[] {
    return this.getAll().filter((r) => r.status === 'PENDING');
  },

  getById(id: string): ReviewRequest | undefined {
    return getStore().reviews.find((r) => r.id === id);
  },

  create(
    data: Omit<ReviewRequest, 'id' | 'submitted_at' | 'status'>
  ): ReviewRequest {
    const review: ReviewRequest = {
      id: generateId(),
      ...data,
      submitted_at: new Date().toISOString(),
      status: 'PENDING',
    };
    getStore().reviews.push(review);

    // Update dataset status to REVIEW
    DatasetRepo.updateStatus(
      data.dataset_id,
      DataStatus.REVIEW,
      data.submitted_by,
      data.submitted_by_name
    );

    BackendApi.submitReview(data).catch(() => {});
    notify();
    return review;
  },

  approve(
    id: string,
    reviewerId: string,
    reviewerName: string
  ): ReviewRequest | undefined {
    const review = getStore().reviews.find((r) => r.id === id);
    if (!review) return undefined;

    review.status = 'APPROVED';
    review.reviewed_by = reviewerId;
    review.reviewed_by_name = reviewerName;
    review.reviewed_at = new Date().toISOString();

    // Update dataset status to PUBLISHED
    DatasetRepo.updateStatus(
      review.dataset_id,
      DataStatus.PUBLISHED,
      reviewerId,
      reviewerName
    );

    BackendApi.approveReview(id, reviewerId).catch(() => {});
    notify();
    return review;
  },

  reject(
    id: string,
    reviewerId: string,
    reviewerName: string,
    reason: string
  ): ReviewRequest | undefined {
    const review = getStore().reviews.find((r) => r.id === id);
    if (!review) return undefined;

    review.status = 'REJECTED';
    review.reviewed_by = reviewerId;
    review.reviewed_by_name = reviewerName;
    review.reviewed_at = new Date().toISOString();
    review.reject_reason = reason;

    // Update dataset status back to DRAFT
    DatasetRepo.updateStatus(
      review.dataset_id,
      DataStatus.DRAFT,
      reviewerId,
      reviewerName,
      reason
    );

    BackendApi.rejectReview(id, reviewerId, reason).catch(() => {});
    notify();
    return review;
  },
};

// ============================================================
// USER REPOSITORY
// ============================================================

export const UserRepo = {
  getAll(): User[] {
    return getStore().users;
  },

  getById(id: string): User | undefined {
    return getStore().users.find((u) => u.id === id);
  },

  getByEmail(email: string): User | undefined {
    return getStore().users.find((u) => u.email === email);
  },
};

// ============================================================
// DASHBOARD
// ============================================================

export function getDashboardSummary(): DashboardSummary {
  const datasets = DatasetRepo.getAll();
  const records = getStore().records.filter((r) => !r.is_deleted);
  const pendingReviews = ReviewRepo.getPending();

  return {
    total_datasets: datasets.filter(
      (d) => d.status !== DataStatus.ARCHIVED
    ).length,
    published_records: records.filter(
      (r) => r.status === DataStatus.PUBLISHED
    ).length,
    draft_records: records.filter(
      (r) => r.status === DataStatus.DRAFT
    ).length,
    pending_review: pendingReviews.length,
  };
}

// ============================================================
// VALIDATION
// ============================================================

export function validateRecord(
  record: Partial<DataRecord>,
  datasetId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!record.indicator?.trim()) {
    errors.push({
      field: 'indicator',
      message: 'Indikator wajib diisi.',
      severity: 'error',
    });
  }

  if (!record.region?.trim()) {
    errors.push({
      field: 'region',
      message: 'Wilayah wajib diisi.',
      severity: 'error',
    });
  }

  if (!record.period?.trim()) {
    errors.push({
      field: 'period',
      message: 'Periode/tahun wajib diisi.',
      severity: 'error',
    });
  } else {
    // Validate year format
    const yearMatch = record.period.match(/^\d{4}$/);
    const quarterMatch = record.period.match(/^\d{4}-Q[1-4]$/);
    const monthMatch = record.period.match(/^\d{4}-\d{2}$/);
    if (!yearMatch && !quarterMatch && !monthMatch) {
      errors.push({
        field: 'period',
        message:
          'Format periode tidak valid. Gunakan: 2025, 2025-Q1, atau 2025-01.',
        severity: 'error',
      });
    }
  }

  if (record.value === null || record.value === undefined) {
    errors.push({
      field: 'value',
      message: 'Nilai wajib diisi.',
      severity: 'error',
    });
  } else if (typeof record.value === 'number' && isNaN(record.value)) {
    errors.push({
      field: 'value',
      message: 'Kolom "Nilai" harus berupa angka.',
      severity: 'error',
    });
  }

  if (!record.unit?.trim()) {
    errors.push({
      field: 'unit',
      message: 'Satuan wajib diisi.',
      severity: 'error',
    });
  }

  // Check duplicate
  if (record.indicator && record.region && record.period) {
    const isDuplicate = RecordRepo.checkDuplicate(
      datasetId,
      record.indicator,
      record.region,
      record.period
    );
    if (isDuplicate) {
      errors.push({
        field: 'period',
        message: `Data duplikat. Data untuk ${record.region} ${record.indicator} tahun ${record.period} sudah tersedia.`,
        severity: 'error',
      });
    }
  }

  // Anomaly warning
  if (
    typeof record.value === 'number' &&
    record.indicator &&
    record.region
  ) {
    const anomaly = RecordRepo.checkAnomalies(
      datasetId,
      record.indicator,
      record.region,
      record.value
    );
    if (anomaly) {
      errors.push({
        field: 'value',
        message: anomaly.message,
        severity: 'warning',
      });
    }
  }

  return errors;
}
