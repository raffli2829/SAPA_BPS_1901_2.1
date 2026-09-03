import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import { loadFAQData, saveFAQData, CSV_FILE_PATH } from '../data/csvLoader.js';
import { processUserMessage } from '../nlp/matcher.js';
import { getBotStatus, resetWhatsAppAuth, requestPairing } from '../bot/whatsapp.js';
import {
  loadBackendStore,
  saveBackendStore,
  syncDataToFAQ,
  DataStatus,
  AuditAction,
  Dataset,
  DataRecord,
  ReviewRequest,
  AuditLog
} from '../data/dbStore.js';

export function createWebServer(): express.Express {
  const app = express();

  // ============================================================
  // 0. CORS & MIDDLEWARE CONFIGURATION
  // ============================================================
  const allowedOriginsEnv = process.env.FRONTEND_URL || '*';
  const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim().toLowerCase());

  app.use(cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti curl, mobile app, atau server-to-server)
      if (!origin || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      const originLower = origin.toLowerCase();
      if (allowedOrigins.includes(originLower)) {
        return callback(null, true);
      }
      // Izinkan subdomain vercel / ngrok jika origin cocok
      try {
        const originUrl = new URL(origin);
        const match = allowedOrigins.some(ao => {
          if (ao.startsWith('http')) {
            return new URL(ao).hostname === originUrl.hostname;
          }
          return originUrl.hostname.endsWith(ao.replace(/^\*\./, ''));
        });
        if (match) return callback(null, true);
      } catch {}
      // Default: izinkan untuk menjamin frontend hosting dapat berkomunikasi
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-user-id', 'ngrok-skip-browser-warning'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Middleware kompatibilitas: Otomatis memetakan /api/backend/* ke /api/* jika dipanggil langsung dari hosting
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/backend/')) {
      req.url = req.url.replace('/api/backend/', '/api/');
    }
    next();
  });

  // Helper generator ID
  const uid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  // Middleware pengaman API key untuk endpoint sensitif (opsional jika API_KEY diatur di .env)
  const requireApiKey = (req: Request, res: Response, next: express.NextFunction) => {
    const configuredKey = process.env.API_KEY;
    if (!configuredKey) return next();
    const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (providedKey === configuredKey) return next();
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Akses ditolak. Kunci API tidak valid atau belum disertakan di header x-api-key.'
    });
  };

  // ============================================================
  // HEALTH CHECK ENDPOINT
  // ============================================================
  app.get('/health', (req: Request, res: Response) => {
    const bot = getBotStatus();
    res.json({
      status: 'ok',
      service: 'SAPA BPS WhatsApp Backend',
      port: process.env.PORT || '80',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      botState: bot.state,
      phoneNumber: bot.phoneNumber || null
    });
  });

  // ============================================================
  // 1. DATASETS REST API
  // ============================================================

  // GET /api/datasets
  app.get('/api/datasets', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const { category, search, status } = req.query;

    let list = [...store.datasets];

    if (status) {
      list = list.filter(d => d.status === status);
    }
    if (category) {
      const cat = String(category).toLowerCase();
      list = list.filter(d => d.category.toLowerCase().includes(cat));
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }

    // Update count
    list = list.map(d => ({
      ...d,
      record_count: store.records.filter(r => r.dataset_id === d.id && !r.is_deleted).length
    }));

    res.json({ success: true, data: list, count: list.length });
  });

  // GET /api/datasets/:id
  app.get('/api/datasets/:id', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const dataset = store.datasets.find(d => d.id === req.params.id);
    if (!dataset) {
      res.status(404).json({ success: false, error: 'Dataset tidak ditemukan.' });
      return;
    }
    const count = store.records.filter(r => r.dataset_id === dataset.id && !r.is_deleted).length;
    res.json({ success: true, data: { ...dataset, record_count: count } });
  });

  // POST /api/datasets
  app.post('/api/datasets', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const body = req.body;

    if (!body.name || !body.code || !body.category) {
      res.status(400).json({ success: false, error: 'Nama, kode, dan kategori dataset wajib diisi.' });
      return;
    }

    const now = new Date().toISOString();
    const newDataset: Dataset = {
      id: body.id || `ds-${uid()}`,
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      category: body.category.trim(),
      description: body.description || '',
      definition: body.definition || '',
      geographic_scope: body.geographic_scope || 'Kabupaten Bangka',
      unit: body.unit || '',
      source: body.source || 'BPS Kabupaten Bangka',
      period_type: body.period_type || 'YEARLY',
      status: body.status || DataStatus.DRAFT,
      created_by: body.created_by || 'user-1',
      updated_by: body.updated_by || 'user-1',
      created_at: now,
      updated_at: now,
      record_count: 0
    };

    store.datasets.unshift(newDataset);

    // Audit log
    store.auditLogs.unshift({
      id: `log-${uid()}`,
      entity_type: 'dataset',
      entity_id: newDataset.id,
      entity_name: newDataset.name,
      action: AuditAction.CREATE,
      changes: [{ field: 'status', old_value: null, new_value: newDataset.status }],
      user_id: newDataset.created_by,
      user_name: store.users.find(u => u.id === newDataset.created_by)?.name || 'Admin',
      created_at: now
    });

    saveBackendStore(store);
    res.status(201).json({ success: true, data: newDataset });
  });

  // PUT /api/datasets/:id
  app.put('/api/datasets/:id', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const idx = store.datasets.findIndex(d => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Dataset tidak ditemukan.' });
      return;
    }

    const existing = store.datasets[idx];
    const body = req.body;
    const now = new Date().toISOString();

    const updated: Dataset = {
      ...existing,
      ...body,
      id: existing.id,
      updated_at: now,
    };

    store.datasets[idx] = updated;

    // Audit log
    store.auditLogs.unshift({
      id: `log-${uid()}`,
      entity_type: 'dataset',
      entity_id: updated.id,
      entity_name: updated.name,
      action: AuditAction.UPDATE,
      changes: [{ field: 'updated', old_value: existing.updated_at, new_value: now }],
      user_id: body.updated_by || 'user-1',
      user_name: store.users.find(u => u.id === body.updated_by)?.name || 'Petugas',
      created_at: now
    });

    saveBackendStore(store);
    res.json({ success: true, data: updated });
  });

  // DELETE /api/datasets/:id
  app.delete('/api/datasets/:id', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const idx = store.datasets.findIndex(d => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Dataset tidak ditemukan.' });
      return;
    }

    const deleted = store.datasets.splice(idx, 1)[0];
    // soft delete associated records
    store.records.forEach(r => {
      if (r.dataset_id === deleted.id) r.is_deleted = true;
    });

    saveBackendStore(store);
    res.json({ success: true, message: 'Dataset berhasil dihapus.' });
  });

  // ============================================================
  // 2. DATA RECORDS REST API
  // ============================================================

  // GET /api/records
  app.get('/api/records', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const { dataset_id, period, region, indicator } = req.query;

    let list = store.records.filter(r => !r.is_deleted);

    if (dataset_id) {
      list = list.filter(r => r.dataset_id === dataset_id);
    }
    if (period) {
      list = list.filter(r => r.period === String(period));
    }
    if (region) {
      list = list.filter(r => r.region.toLowerCase().includes(String(region).toLowerCase()));
    }
    if (indicator) {
      list = list.filter(r => r.indicator.toLowerCase().includes(String(indicator).toLowerCase()));
    }

    res.json({ success: true, data: list, count: list.length });
  });

  // POST /api/records
  app.post('/api/records', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const body = req.body;
    const now = new Date().toISOString();

    const newRecord: DataRecord = {
      id: body.id || `rec-${uid()}`,
      dataset_id: body.dataset_id,
      indicator: body.indicator || '',
      region: body.region || 'Kabupaten Bangka',
      period: String(body.period || new Date().getFullYear()),
      value: body.value !== undefined ? (body.value === null ? null : Number(body.value)) : null,
      unit: body.unit || '',
      notes: body.notes || '',
      source: body.source || 'BPS Kabupaten Bangka',
      status: body.status || DataStatus.DRAFT,
      created_by: body.created_by || 'user-1',
      updated_by: body.updated_by || 'user-1',
      created_at: now,
      updated_at: now,
      is_deleted: false
    };

    store.records.push(newRecord);
    saveBackendStore(store);

    // Jika langsung dipublish, sinkronkan ke FAQ CSV
    if (newRecord.status === DataStatus.PUBLISHED) {
      const parentDs = store.datasets.find(d => d.id === newRecord.dataset_id);
      if (parentDs) {
        syncDataToFAQ(parentDs.category, newRecord.indicator, newRecord.period, newRecord.value ?? '-', newRecord.unit);
      }
    }

    res.status(201).json({ success: true, data: newRecord });
  });

  // PUT /api/records/:id
  app.put('/api/records/:id', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const idx = store.records.findIndex(r => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Record tidak ditemukan.' });
      return;
    }

    const existing = store.records[idx];
    const body = req.body;
    const now = new Date().toISOString();

    const updated: DataRecord = {
      ...existing,
      ...body,
      id: existing.id,
      value: body.value !== undefined ? (body.value === null ? null : Number(body.value)) : existing.value,
      updated_at: now
    };

    store.records[idx] = updated;
    saveBackendStore(store);

    if (updated.status === DataStatus.PUBLISHED) {
      const parentDs = store.datasets.find(d => d.id === updated.dataset_id);
      if (parentDs) {
        syncDataToFAQ(parentDs.category, updated.indicator, updated.period, updated.value ?? '-', updated.unit);
      }
    }

    res.json({ success: true, data: updated });
  });

  // DELETE /api/records/:id
  app.delete('/api/records/:id', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const record = store.records.find(r => r.id === req.params.id);
    if (!record) {
      res.status(404).json({ success: false, error: 'Record tidak ditemukan.' });
      return;
    }

    record.is_deleted = true;
    record.updated_at = new Date().toISOString();
    saveBackendStore(store);

    res.json({ success: true, message: 'Record berhasil dihapus.' });
  });

  // POST /api/records/bulk
  app.post('/api/records/bulk', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const { dataset_id, records } = req.body;

    if (!Array.isArray(records)) {
      res.status(400).json({ success: false, error: 'Format records harus array.' });
      return;
    }

    const now = new Date().toISOString();
    const processed: DataRecord[] = [];

    for (const item of records) {
      if (item.id) {
        const existingIdx = store.records.findIndex(r => r.id === item.id);
        if (existingIdx !== -1) {
          store.records[existingIdx] = {
            ...store.records[existingIdx],
            ...item,
            updated_at: now
          };
          processed.push(store.records[existingIdx]);
          continue;
        }
      }

      const newRec: DataRecord = {
        id: item.id || `rec-${uid()}`,
        dataset_id: item.dataset_id || dataset_id,
        indicator: item.indicator || '',
        region: item.region || 'Kabupaten Bangka',
        period: String(item.period || new Date().getFullYear()),
        value: item.value !== undefined ? (item.value === null ? null : Number(item.value)) : null,
        unit: item.unit || '',
        notes: item.notes || '',
        source: item.source || 'BPS Kabupaten Bangka',
        status: item.status || DataStatus.DRAFT,
        created_by: item.created_by || 'user-1',
        updated_by: item.updated_by || 'user-1',
        created_at: now,
        updated_at: now,
        is_deleted: false
      };
      store.records.push(newRec);
      processed.push(newRec);
    }

    saveBackendStore(store);
    res.json({ success: true, data: processed, count: processed.length });
  });

  // ============================================================
  // 3. REVIEWS & AUDIT LOGS REST API
  // ============================================================

  // GET /api/reviews
  app.get('/api/reviews', (req: Request, res: Response) => {
    const store = loadBackendStore();
    res.json({ success: true, data: store.reviews });
  });

  // POST /api/reviews (submit review)
  app.post('/api/reviews', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const body = req.body;
    const now = new Date().toISOString();

    const parentDs = store.datasets.find(d => d.id === body.dataset_id);
    const newRev: ReviewRequest = {
      id: `rev-${uid()}`,
      dataset_id: body.dataset_id,
      dataset_name: parentDs?.name || body.dataset_name || 'Dataset BPS',
      record_ids: body.record_ids || [],
      description: body.description || 'Pengajuan review dan verifikasi data statistik.',
      submitted_by: body.submitted_by || 'user-1',
      submitted_by_name: store.users.find(u => u.id === body.submitted_by)?.name || 'Ahmad Fauzi',
      submitted_at: now,
      status: 'PENDING'
    };

    // Update dataset status to REVIEW
    if (parentDs) {
      parentDs.status = DataStatus.REVIEW;
      parentDs.updated_at = now;
    }

    // Update record status
    if (newRev.record_ids.length > 0) {
      store.records.forEach(r => {
        if (newRev.record_ids.includes(r.id)) {
          r.status = DataStatus.REVIEW;
          r.updated_at = now;
        }
      });
    }

    store.reviews.unshift(newRev);

    store.auditLogs.unshift({
      id: `log-${uid()}`,
      entity_type: 'dataset',
      entity_id: newRev.dataset_id,
      entity_name: newRev.dataset_name,
      action: AuditAction.SUBMIT_REVIEW,
      changes: [{ field: 'status', old_value: 'DRAFT', new_value: 'REVIEW' }],
      user_id: newRev.submitted_by,
      user_name: newRev.submitted_by_name,
      reason: newRev.description,
      created_at: now
    });

    saveBackendStore(store);
    res.status(201).json({ success: true, data: newRev });
  });

  // POST /api/reviews/:id/approve
  app.post('/api/reviews/:id/approve', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const rev = store.reviews.find(r => r.id === req.params.id);
    if (!rev) {
      res.status(404).json({ success: false, error: 'Permintaan review tidak ditemukan.' });
      return;
    }

    const { reviewer_id } = req.body;
    const now = new Date().toISOString();
    const reviewerName = store.users.find(u => u.id === reviewer_id)?.name || 'Siti Nurhaliza';

    rev.status = 'APPROVED';
    rev.reviewed_by = reviewer_id || 'user-2';
    rev.reviewed_by_name = reviewerName;
    rev.reviewed_at = now;

    // Publish dataset and records
    const ds = store.datasets.find(d => d.id === rev.dataset_id);
    if (ds) {
      ds.status = DataStatus.PUBLISHED;
      ds.updated_at = now;
    }

    store.records.forEach(r => {
      if (r.dataset_id === rev.dataset_id && (rev.record_ids.length === 0 || rev.record_ids.includes(r.id))) {
        r.status = DataStatus.PUBLISHED;
        r.updated_at = now;
        // Sync to FAQ CSV
        if (ds) {
          syncDataToFAQ(ds.category, r.indicator, r.period, r.value ?? '-', r.unit);
        }
      }
    });

    store.auditLogs.unshift({
      id: `log-${uid()}`,
      entity_type: 'dataset',
      entity_id: rev.dataset_id,
      entity_name: rev.dataset_name,
      action: AuditAction.APPROVE,
      changes: [{ field: 'status', old_value: 'REVIEW', new_value: 'PUBLISHED' }],
      user_id: rev.reviewed_by || 'user-2',
      user_name: rev.reviewed_by_name || 'Siti Nurhaliza',
      reason: 'Data diverifikasi & disetujui untuk publikasi.',
      created_at: now
    });

    saveBackendStore(store);
    res.json({ success: true, data: rev, message: 'Data berhasil disetujui dan dipublikasikan.' });
  });

  // POST /api/reviews/:id/reject
  app.post('/api/reviews/:id/reject', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const rev = store.reviews.find(r => r.id === req.params.id);
    if (!rev) {
      res.status(404).json({ success: false, error: 'Permintaan review tidak ditemukan.' });
      return;
    }

    const { reviewer_id, reason } = req.body;
    const now = new Date().toISOString();
    const reviewerName = store.users.find(u => u.id === reviewer_id)?.name || 'Siti Nurhaliza';

    rev.status = 'REJECTED';
    rev.reviewed_by = reviewer_id || 'user-2';
    rev.reviewed_by_name = reviewerName;
    rev.reviewed_at = now;
    rev.reject_reason = reason || 'Perlu perbaikan data statistik.';

    const ds = store.datasets.find(d => d.id === rev.dataset_id);
    if (ds) {
      ds.status = DataStatus.DRAFT;
      ds.updated_at = now;
    }

    store.records.forEach(r => {
      if (r.dataset_id === rev.dataset_id && (rev.record_ids.length === 0 || rev.record_ids.includes(r.id))) {
        r.status = DataStatus.DRAFT;
        r.updated_at = now;
      }
    });

    store.auditLogs.unshift({
      id: `log-${uid()}`,
      entity_type: 'dataset',
      entity_id: rev.dataset_id,
      entity_name: rev.dataset_name,
      action: AuditAction.REJECT,
      changes: [{ field: 'status', old_value: 'REVIEW', new_value: 'DRAFT' }],
      user_id: rev.reviewed_by || 'user-2',
      user_name: rev.reviewed_by_name || 'Siti Nurhaliza',
      reason: rev.reject_reason,
      created_at: now
    });

    saveBackendStore(store);
    res.json({ success: true, data: rev, message: 'Review ditolak, status dikembalikan ke Draft.' });
  });

  // GET /api/audit-logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const store = loadBackendStore();
    res.json({ success: true, data: store.auditLogs });
  });

  // POST /api/audit-logs
  app.post('/api/audit-logs', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const body = req.body;
    const now = new Date().toISOString();

    const log: AuditLog = {
      id: body.id || `log-${uid()}`,
      entity_type: body.entity_type || 'dataset',
      entity_id: body.entity_id || '',
      entity_name: body.entity_name || '',
      action: body.action || AuditAction.UPDATE,
      changes: body.changes || [],
      user_id: body.user_id || 'user-1',
      user_name: body.user_name || store.users.find(u => u.id === body.user_id)?.name || 'Petugas',
      reason: body.reason,
      created_at: now
    };

    store.auditLogs.unshift(log);
    saveBackendStore(store);
    res.status(201).json({ success: true, data: log });
  });

  // ============================================================
  // 4. USERS & CATEGORIES & DASHBOARD SUMMARY
  // ============================================================

  // GET /api/users
  app.get('/api/users', (req: Request, res: Response) => {
    const store = loadBackendStore();
    res.json({ success: true, data: store.users });
  });

  // GET /api/categories
  app.get('/api/categories', (req: Request, res: Response) => {
    const store = loadBackendStore();
    res.json({ success: true, data: store.categories });
  });

  // GET /api/dashboard/summary
  app.get('/api/dashboard/summary', (req: Request, res: Response) => {
    const store = loadBackendStore();
    const activeRecords = store.records.filter(r => !r.is_deleted);
    const summary = {
      total_datasets: store.datasets.length,
      published_records: activeRecords.filter(r => r.status === DataStatus.PUBLISHED).length,
      draft_records: activeRecords.filter(r => r.status === DataStatus.DRAFT).length,
      pending_review: store.reviews.filter(r => r.status === 'PENDING').length
    };
    res.json({ success: true, data: summary });
  });

  // ============================================================
  // 5. BOT WHATSAPP & AI CHAT INTEGRATION
  // ============================================================

  // GET /api/bot/status
  app.get('/api/bot/status', (req: Request, res: Response) => {
    const status = getBotStatus();
    res.json({
      success: true,
      data: {
        ...status,
        serverTime: new Date().toISOString()
      }
    });
  });

  // POST /api/bot/reset - Memaksa pembersihan sesi lama dan memicu QR baru
  app.post('/api/bot/reset', async (req: Request, res: Response) => {
    try {
      await resetWhatsAppAuth();
      res.json({ success: true, message: 'Sesi WhatsApp berhasil direset. Silakan tunggu QR code baru.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal reset sesi' });
    }
  });

  // POST /api/bot/logout - Memutuskan sambungan host dan memicu QR baru untuk login ulang
  app.post('/api/bot/logout', async (req: Request, res: Response) => {
    try {
      await resetWhatsAppAuth();
      res.json({ success: true, message: 'Sambungan host berhasil diputuskan. Menyiapkan QR code baru...' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal logout' });
    }
  });

  // POST /api/bot/pairing-code - Meminta kode 8-digit untuk login tanpa scan kamera
  app.post('/api/bot/pairing-code', async (req: Request, res: Response) => {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ success: false, message: 'Nomor telepon wajib diisi' });
      return;
    }
    try {
      const code = await requestPairing(phone);
      if (code) {
        res.json({ success: true, code });
      } else {
        res.status(400).json({ success: false, message: 'Bot sudah terhubung atau socket belum siap. Coba refresh halaman.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal meminta pairing code' });
    }
  });



  // POST /api/chat & /chat
  const handleChat = async (req: Request, res: Response) => {
    const message = req.body.message || '';
    const sessionId = req.body.sessionId || String(req.ip || 'web-client');
    if (!message.trim()) {
      res.json({ success: false, response: 'Silakan ketik pertanyaan atau topik statistik resmi BPS.' });
      return;
    }
    const reply = await processUserMessage(message, undefined, sessionId);
    res.json({ success: true, response: reply });
  };

  app.post('/api/chat', handleChat);
  app.post('/chat', handleChat);

  app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
    const message = req.body.message || '';
    const sessionId = req.body.sessionId || String(req.ip || 'webhook-client');
    const reply = await processUserMessage(message, undefined, sessionId);
    res.json({ status: 'success', response: reply });
  });

  // ============================================================
  // 6. CSV FAQ REST API (Original Compatible)
  // ============================================================

  app.get('/api/faqs', (req: Request, res: Response) => {
    const data = loadFAQData();
    const list = Object.entries(data).map(([pertanyaan, jawaban]) => ({
      pertanyaan,
      jawaban
    }));
    res.json(list);
  });

  app.post('/api/faqs/save', (req: Request, res: Response) => {
    const { pertanyaan, jawaban, old_pertanyaan } = req.body;
    if (!pertanyaan || !jawaban) {
      res.status(400).json({ status: 'error', message: 'Pertanyaan dan jawaban wajib diisi' });
      return;
    }

    const currentData = { ...loadFAQData() };

    if (old_pertanyaan && old_pertanyaan !== pertanyaan && currentData[old_pertanyaan]) {
      delete currentData[old_pertanyaan];
    }

    currentData[pertanyaan.trim()] = jawaban.trim();
    const success = saveFAQData(currentData);

    if (success) {
      res.json({ status: 'success', message: 'Data statistik berhasil disimpan!' });
    } else {
      res.status(500).json({ status: 'error', message: 'Gagal menyimpan ke file data_faq.csv' });
    }
  });

  app.post('/api/faqs/delete', (req: Request, res: Response) => {
    const { pertanyaan } = req.body;
    if (!pertanyaan) {
      res.status(400).json({ status: 'error', message: 'Parameter pertanyaan wajib diisi' });
      return;
    }

    const currentData = { ...loadFAQData() };
    if (currentData[pertanyaan]) {
      delete currentData[pertanyaan];
      const success = saveFAQData(currentData);
      if (success) {
        res.json({ status: 'success', message: 'Data berhasil dihapus!' });
        return;
      }
    }
    res.status(404).json({ status: 'error', message: 'Data tidak ditemukan' });
  });

  app.get('/api/download-csv', (req: Request, res: Response) => {
    if (fs.existsSync(CSV_FILE_PATH)) {
      res.download(CSV_FILE_PATH, 'data_faq_bps_bangka.csv');
    } else {
      res.status(404).json({ status: 'error', message: 'File CSV belum tersedia' });
    }
  });

  // ============================================================
  // 7. WEB ADMIN UNIFIED REDIRECT / ENTRY
  // ============================================================

  // Redirect / dan /admin ke frontend (default localhost:3000 atau FRONTEND_URL)
  app.get(['/', '/admin'], (req: Request, res: Response) => {
    const target = process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:3000';
    res.redirect(target);
  });

  return app;
}
