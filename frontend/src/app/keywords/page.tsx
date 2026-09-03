'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast, EmptyState } from '@/components/ui';
import { ChatbotTemplateRepo, subscribe } from '@/lib/repository';
import { ChatbotTemplate } from '@/lib/types';
import { BackendApi } from '@/lib/apiClient';
import {
  MessageSquare,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Send,
  Smartphone,
  Bot,
  Search,
  Check,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Hash,
} from 'lucide-react';

export default function KeywordsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<ChatbotTemplate[]>(() => {
    try {
      return ChatbotTemplateRepo.getAll();
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChatbotTemplate | null>(null);
  const [formKeyword, setFormKeyword] = useState('');
  const [formResponse, setFormResponse] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // WhatsApp Simulator State
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nSilakan ketik kata kunci statistik (misal: *kemiskinan*, *ipm*, *penduduk*, atau *menu*) untuk melihat data resmi.',
      time: '08:00',
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  // Bot Connection Status
  const [botStatus, setBotStatus] = useState<{ state: string; phoneNumber?: string }>({ state: 'connected' });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function reload() {
      setTemplates(ChatbotTemplateRepo.getAll());
    }

    // Try background sync with backend FAQs
    ChatbotTemplateRepo.syncWithBackendFaqs().then(() => {
      setTemplates(ChatbotTemplateRepo.getAll());
    });

    BackendApi.getBotStatus().then((st) => {
      if (st) setBotStatus(st);
    });

    const unsub = subscribe(reload);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category || 'Umum'));
    return ['ALL', ...Array.from(set)];
  }, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.keyword.toLowerCase().includes(search.toLowerCase()) ||
        t.response.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || t.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [templates, search, selectedCategory]);

  const handleOpenModal = (tpl?: ChatbotTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setFormKeyword(tpl.keyword);
      setFormResponse(tpl.response);
      setFormCategory(tpl.category || 'Umum');
    } else {
      setEditingTemplate(null);
      setFormKeyword('');
      setFormResponse('');
      setFormCategory('Data Statistik');
    }
    setIsModalOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyword.trim() || !formResponse.trim()) {
      setToast({ msg: 'Kata kunci dan balasan template wajib diisi.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        ChatbotTemplateRepo.update(editingTemplate.id, {
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Template balasan chatbot berhasil diperbarui.', type: 'success' });
      } else {
        ChatbotTemplateRepo.create({
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Kata kunci baru berhasil ditambahkan ke chatbot.', type: 'success' });
      }
      setIsModalOpen(false);
      setTemplates(ChatbotTemplateRepo.getAll());
    } catch {
      setToast({ msg: 'Gagal menyimpan template chatbot.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = (id: string, keyword: string) => {
    if (confirm(`Hapus template kata kunci "${keyword}" dari bot WhatsApp?`)) {
      ChatbotTemplateRepo.delete(id);
      setTemplates(ChatbotTemplateRepo.getAll());
      setToast({ msg: `Kata kunci "${keyword}" berhasil dihapus.`, type: 'success' });
    }
  };

  // WhatsApp Simulator Action
  const handleSimSend = (textToSend?: string) => {
    const text = textToSend || simInput;
    if (!text.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Add user message
    setSimMessages((prev) => [...prev, { sender: 'user', text, time: timeStr }]);
    if (!textToSend) setSimInput('');
    setIsBotTyping(true);

    // Find match in templates
    setTimeout(() => {
      const clean = text.trim().toLowerCase();
      let matched = templates.find((t) => t.keyword.toLowerCase() === clean);

      if (!matched) {
        matched = templates.find((t) => clean.includes(t.keyword.toLowerCase()) || t.keyword.toLowerCase().includes(clean));
      }

      let reply = '';
      if (matched) {
        reply = matched.response;
      } else if (clean === 'menu' || clean === 'sapa' || clean === 'halo' || clean === 'p') {
        reply =
          `📋 *MENU UTAMA LAYANAN DATA SAPA BPS*\n🏛️ *BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Silakan pilih topik informasi statistik resmi BPS Kab. Bangka berikut:\n\n` +
          `1️⃣ *Jumlah Penduduk*\n2️⃣ *Data Kemiskinan*\n3️⃣ *Pertumbuhan Ekonomi*\n4️⃣ *Indeks Pembangunan Manusia (IPM)*\n5️⃣ *Tenaga Kerja*\n6️⃣ *Produk Domestik Regional Bruto (PDRB)*\n🔟 *Hubungi Petugas PST BPS*\n\n` +
          `💡 _Balas dengan angka atau ketik pertanyaan langsung._`;
      } else {
        reply =
          `Mohon maaf, kata kunci *"${text}"* belum terdaftar dalam template cepat kami.\n\n` +
          `💡 _Ketik *menu* untuk melihat topik data resmi BPS Kab. Bangka, atau hubungi petugas PST kami._`;
      }

      setSimMessages((prev) => [...prev, { sender: 'bot', text: reply, time: timeStr }]);
      setIsBotTyping(false);
    }, 450);
  };

  const handleTestInSimulator = (keyword: string) => {
    handleSimSend(keyword);
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <Header
        title="Template Chatbot WhatsApp"
        subtitle="Kelola kata kunci & respons otomatis asisten virtual SAPA BPS Kab. Bangka"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => handleOpenModal()}
          >
            Tambah Kata Kunci
          </Button>
        }
      />

      <div className="page-content" style={{ maxWidth: 1280 }}>
        {/* Top Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Total Template Chatbot
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--slate-900)' }}>
                {templates.length}
              </h3>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Status Bot WhatsApp
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: botStatus.state === 'connected' ? '#10b981' : '#f59e0b',
                    display: 'inline-block',
                  }}
                />
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--slate-900)' }}>
                  {botStatus.state === 'connected' ? 'Aktif & Siap Membalas' : 'Standby / QR Siap'}
                </h3>
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Sinkronisasi CSV Bot
              </p>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 0', color: 'var(--slate-900)' }}>
                data_faq.csv (Live)
              </h3>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: '#f1f5f9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCheck size={20} />
            </div>
          </div>
        </div>

        {/* 2 Columns: Template Management & Interactive Simulator */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(340px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
          className="chatbot-layout-grid"
        >
          {/* Left Column: Template List */}
          <div>
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 className="section-title">
                    <Hash size={18} style={{ color: 'var(--primary-600)' }} />
                    Daftar Kata Kunci & Template Balasan
                  </h2>
                  <p className="section-subtitle">
                    Pesan di bawah akan otomatis terkirim saat pengguna WhatsApp mengetik kata kunci terkait
                  </p>
                </div>
              </div>

              <div className="section-body">
                {/* Search & Category Filter */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                    />
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Cari kata kunci atau isi pesan balasan..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, maxWidth: '100%' }}>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          border: selectedCategory === cat ? '1px solid var(--primary-600)' : '1px solid var(--slate-200)',
                          background: selectedCategory === cat ? 'var(--primary-600)' : '#ffffff',
                          color: selectedCategory === cat ? '#ffffff' : 'var(--slate-600)',
                          transition: 'all 150ms',
                        }}
                      >
                        {cat === 'ALL' ? 'Semua Kategori' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Templates List Cards */}
                {filteredTemplates.length === 0 ? (
                  <EmptyState
                    title="Tidak Ada Template Chatbot"
                    description={search ? `Tidak ada kata kunci yang cocok dengan "${search}".` : 'Belum ada template yang terdaftar.'}
                    action={
                      <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
                        Tambah Template Sekarang
                      </Button>
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--slate-200)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px 18px',
                          boxShadow: 'var(--shadow-subtle)',
                          transition: 'border-color 150ms, box-shadow 150ms',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: 'var(--slate-900)',
                                  background: 'var(--slate-100)',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                💬 &quot;{tpl.keyword}&quot;
                              </span>
                              {tpl.category && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: 'var(--primary-700)',
                                    background: 'var(--primary-50)',
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    border: '1px solid var(--primary-100)',
                                  }}
                                >
                                  {tpl.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleTestInSimulator(tpl.keyword)}
                              title="Uji coba balasan di Simulator"
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--primary-700)',
                                background: 'var(--primary-50)',
                                border: '1px solid var(--primary-200)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Sparkles size={12} /> Coba di Simulator
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenModal(tpl)}
                              style={{
                                padding: '4px 6px',
                                color: 'var(--slate-600)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              title="Edit Template"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.keyword)}
                              style={{
                                padding: '4px 6px',
                                color: 'var(--error-text)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              title="Hapus Template"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Message Preview Box */}
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid var(--slate-150)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                            fontSize: 12.5,
                            color: 'var(--slate-700)',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 120,
                            overflowY: 'auto',
                            lineHeight: 1.5,
                          }}
                        >
                          {tpl.response}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Simulator */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                height: 600,
              }}
            >
              {/* WhatsApp Simulator Header */}
              <div
                style={{
                  background: '#075e54',
                  color: '#ffffff',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#128c7e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  🤖
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    SAPA BPS Kab. Bangka
                  </h4>
                  <span style={{ fontSize: 11, color: '#a7f3d0' }}>
                    {isBotTyping ? 'sedang mengetik...' : 'online (Asisten Statistik)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSimMessages([
                      {
                        sender: 'bot',
                        text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nKetik kata kunci (misal: *kemiskinan*, *ipm*, *penduduk*, atau *menu*) untuk mencoba balasan.',
                        time: '08:00',
                      },
                    ])
                  }
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.8 }}
                  title="Reset Obrolan Simulator"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Chat Body (WhatsApp Background look) */}
              <div
                style={{
                  flex: 1,
                  background: '#efeae2',
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      color: '#54656f',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                    }}
                  >
                    Simulator Chatbot WhatsApp BPS
                  </span>
                </div>

                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: msg.sender === 'user' ? '#d9fdd3' : '#ffffff',
                      borderRadius: msg.sender === 'user' ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                      padding: '8px 12px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: '#111b21',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: 10,
                        color: '#667781',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 3,
                      }}
                    >
                      {msg.time}
                      {msg.sender === 'user' && <CheckCheck size={12} color="#53bdeb" />}
                    </div>
                  </div>
                ))}

                {isBotTyping && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#ffffff',
                      borderRadius: '0px 8px 8px 8px',
                      padding: '8px 14px',
                      fontSize: 11.5,
                      color: '#667781',
                      fontStyle: 'italic',
                    }}
                  >
                    Bot sedang merangkai data...
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div
                style={{
                  background: '#f0f2f5',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  placeholder="Ketik kata kunci untuk menguji..."
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimSend();
                  }}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1px solid #d1d7db',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSimSend()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#00a884',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Kirim Pesan"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Template */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 600,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--slate-900)' }}>
                  {editingTemplate ? 'Edit Template Chatbot' : 'Tambah Kata Kunci & Template Balasan'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--slate-500)' }}>
                  Pesan balasan akan otomatis terformat rapi di WhatsApp pengguna
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--slate-400)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="input-label" htmlFor="kw">
                    Kata Kunci Pertanyaan (Trigger)<span className="input-required">*</span>
                  </label>
                  <input
                    id="kw"
                    type="text"
                    required
                    className="text-input"
                    placeholder="Contoh: Jumlah Penduduk, Kemiskinan 2024, Kontak Petugas"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                  />
                  <p className="input-hint">Jika pengguna WhatsApp mengetik kalimat ini, bot akan langsung mengirim template di bawah.</p>
                </div>

                <div>
                  <label className="input-label" htmlFor="cat">
                    Kategori / Topik
                  </label>
                  <input
                    id="cat"
                    type="text"
                    className="text-input"
                    placeholder="Contoh: Kependudukan, Kemiskinan, Layanan PST"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="input-label" htmlFor="resp">
                      Isi Pesan Balasan WhatsApp (Template)<span className="input-required">*</span>
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '*Teks Tebal*')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        *B*
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '_Teks Miring_')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        _I_
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Garis
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="resp"
                    required
                    className="textarea-input"
                    rows={6}
                    placeholder="Tuliskan format pesan balasan resmi BPS..."
                    value={formResponse}
                    onChange={(e) => setFormResponse(e.target.value)}
                  />
                  <p className="input-hint">Mendukung format WhatsApp: *tebal*, _miring_, dan baris baru.</p>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" loading={isSaving} icon={<Sparkles size={14} />}>
                  Simpan Template
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
