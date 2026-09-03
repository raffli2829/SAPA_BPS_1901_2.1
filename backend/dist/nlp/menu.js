export function generateDynamicMenu(faqData) {
    return (`📋 *MENU UTAMA LAYANAN DATA SAPA BPS*\n` +
        `🏛️ *BPS KABUPATEN BANGKA*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Silakan pilih topik informasi statistik resmi BPS Kab. Bangka berikut:\n\n` +
        `1️⃣ *Jumlah Penduduk*\n` +
        `2️⃣ *Data Kemiskinan*\n` +
        `3️⃣ *Pertumbuhan Ekonomi*\n` +
        `4️⃣ *Indeks Pembangunan Manusia (IPM)*\n` +
        `5️⃣ *Tenaga Kerja*\n` +
        `6️⃣ *Produk Domestik Regional Bruto (PDRB)*\n` +
        `7️⃣ *Indeks Pembangunan Gender (IPG)*\n` +
        `8️⃣ *Dimensi Pendidikan (RLS & HLS)*\n` +
        `9️⃣ *Apa saja layanan BPS?*\n` +
        `🔟 *Hubungi Petugas PST BPS*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Balas dengan mengetik *Nomor* (misal: *1* atau *8*), ketik pertanyaan langsung (misal: "IPM 2024"), atau ketik *petugas* untuk konsultasi PST._`);
}
export function getFriendlyGreeting(faqData) {
    return (`Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n` +
        `Sistem Asisten & Pelayanan Statistik Terpadu BPS Kabupaten Bangka.\n\n` +
        generateDynamicMenu(faqData));
}
export function formatPrettyResponse(topic, content) {
    const cleanContent = content.replace(/<br\s*\/?>/gi, '\n');
    return (`📌 *${topic}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${cleanContent}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Ketik *menu* untuk melihat topik data lainnya, atau ketik *petugas* jika butuh data lanjutan._`);
}
export function getFAQByIndex(indexNum, faqData) {
    const orderedTopics = [
        "Jumlah Penduduk",
        "Data Kemiskinan",
        "Pertumbuhan Ekonomi",
        "Indeks Pembangunan Manusia (IPM)",
        "Tenaga Kerja",
        "Produk Domestik Regional Bruto (PDRB)",
        "Indeks Pembangunan Gender (IPG)",
        "Dimensi Pendidikan (RLS & HLS)",
        "Apa saja layanan BPS?",
        "Hubungi Petugas PST BPS"
    ];
    if (indexNum >= 1 && indexNum <= orderedTopics.length) {
        const topic = orderedTopics[indexNum - 1];
        if (faqData[topic]) {
            return { topic, answer: faqData[topic] };
        }
    }
    const keys = Object.keys(faqData);
    if (indexNum >= 1 && indexNum <= keys.length) {
        const topic = keys[indexNum - 1];
        return { topic, answer: faqData[topic] };
    }
    return null;
}
