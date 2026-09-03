// ============================================================
// SAPA BPS 1901 IN — Backend API Client Integration
// ============================================================

import {
  Dataset,
  DataRecord,
  ReviewRequest,
  AuditLog,
  User,
  Category,
  DashboardSummary,
} from './types';

const BASE_URL = typeof window !== 'undefined' ? '' : (process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000');

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      console.warn(`[API] HTTP ${res.status} pada ${url}`);
      return null;
    }

    const json = await res.json();
    return json?.data !== undefined ? json.data : json;
  } catch {
    // Backend mungkin belum running atau offline
    return null;
  }
}

export const BackendApi = {
  // Datasets
  async getDatasets(): Promise<Dataset[] | null> {
    return safeFetch<Dataset[]>(`${BASE_URL}/api/backend/datasets`);
  },

  async getDatasetById(id: string): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets/${id}`);
  },

  async createDataset(dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets`, {
      method: 'POST',
      body: JSON.stringify(dataset),
    });
  },

  async updateDataset(id: string, dataset: Partial<Dataset>): Promise<Dataset | null> {
    return safeFetch<Dataset>(`${BASE_URL}/api/backend/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataset),
    });
  },

  async deleteDataset(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/backend/datasets/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  // Records
  async getRecords(datasetId?: string): Promise<DataRecord[] | null> {
    const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/backend/records${q}`);
  },

  async createRecord(record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/backend/records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  async updateRecord(id: string, record: Partial<DataRecord>): Promise<DataRecord | null> {
    return safeFetch<DataRecord>(`${BASE_URL}/api/backend/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  async deleteRecord(id: string): Promise<boolean> {
    const res = await safeFetch<{ success: boolean }>(`${BASE_URL}/api/backend/records/${id}`, {
      method: 'DELETE',
    });
    return !!res?.success;
  },

  async bulkSaveRecords(datasetId: string, records: Partial<DataRecord>[]): Promise<DataRecord[] | null> {
    return safeFetch<DataRecord[]>(`${BASE_URL}/api/backend/records/bulk`, {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, records }),
    });
  },

  // Reviews
  async getReviews(): Promise<ReviewRequest[] | null> {
    return safeFetch<ReviewRequest[]>(`${BASE_URL}/api/backend/reviews`);
  },

  async submitReview(data: {
    dataset_id: string;
    dataset_name?: string;
    record_ids?: string[];
    description?: string;
    submitted_by?: string;
  }): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveReview(id: string, reviewerId?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId }),
    });
  },

  async rejectReview(id: string, reviewerId?: string, reason?: string): Promise<ReviewRequest | null> {
    return safeFetch<ReviewRequest>(`${BASE_URL}/api/backend/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_id: reviewerId, reason }),
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[] | null> {
    return safeFetch<AuditLog[]>(`${BASE_URL}/api/backend/audit-logs`);
  },

  async logAudit(log: Partial<AuditLog>): Promise<AuditLog | null> {
    return safeFetch<AuditLog>(`${BASE_URL}/api/backend/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },

  // Users & Categories & Summary
  async getUsers(): Promise<User[] | null> {
    return safeFetch<User[]>(`${BASE_URL}/api/backend/users`);
  },

  async getCategories(): Promise<Category[] | null> {
    return safeFetch<Category[]>(`${BASE_URL}/api/backend/categories`);
  },

  async getDashboardSummary(): Promise<DashboardSummary | null> {
    return safeFetch<DashboardSummary>(`${BASE_URL}/api/backend/dashboard/summary`);
  },

  // Bot Status & Chat Integration
  async getBotStatus(): Promise<{ state: string; qr: string | null; phoneNumber?: string } | null> {
    return safeFetch<{ state: string; qr: string | null; phoneNumber?: string }>(`${BASE_URL}/api/bot/status`);
  },

  async sendChatMessage(message: string): Promise<{ response: string } | null> {
    return safeFetch<{ response: string }>(`${BASE_URL}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getFaqs(): Promise<Array<{ pertanyaan: string; jawaban: string }> | null> {
    return safeFetch<Array<{ pertanyaan: string; jawaban: string }>>(`${BASE_URL}/api/faqs`);
  }
};
