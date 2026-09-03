import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleIncomingMessages } from './handlers.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../auth_info');
let reconnectTimeout = null;
let currentSocket = null;
let botStatus = {
    state: 'disconnected',
    qr: null,
};
export function getBotStatus() {
    return botStatus;
}
export function getWhatsAppSocket() {
    return currentSocket;
}
export async function requestPairing(phoneNumber) {
    if (!currentSocket)
        return null;
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('08')) {
        cleanPhone = '628' + cleanPhone.slice(2);
    }
    try {
        if (!currentSocket.authState.creds.registered) {
            const code = await currentSocket.requestPairingCode(cleanPhone);
            return code;
        }
        return null;
    }
    catch (err) {
        console.error('[PAIRING ERROR]', err);
        throw err;
    }
}
export async function resetWhatsAppAuth() {
    try {
        if (currentSocket) {
            try {
                currentSocket.end(undefined);
            }
            catch { }
            currentSocket = null;
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        botStatus.state = 'connecting';
        botStatus.qr = null;
        botStatus.phoneNumber = undefined;
        console.log('[RESET] auth_info dihapus. Memulai ulang bot WhatsApp untuk QR baru...');
        setTimeout(() => {
            startWhatsAppBot();
        }, 1000);
    }
    catch (err) {
        console.error('[ERROR] Gagal reset auth WhatsApp:', err);
    }
}
let hasPrintedQR = false;
export async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version = [2, 3000, 1043857760];
    try {
        const fetched = await fetchLatestBaileysVersion();
        if (fetched?.version)
            version = fetched.version;
    }
    catch (e) { }
    botStatus.state = 'connecting';
    hasPrintedQR = false;
    const logger = pino({ level: 'silent' });
    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.windows('Desktop'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
    });
    currentSocket = sock;
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            botStatus.state = 'qr_ready';
            botStatus.qr = qr;
            if (!hasPrintedQR) {
                hasPrintedQR = true;
                console.log('\n===========================================================');
                console.log('       SCAN QR CODE DI BAWAH INI DENGAN WHATSAPP           ');
                console.log('===========================================================\n');
                qrcode.generate(qr, { small: true });
                console.log('\n[PETUNJUK] Buka WhatsApp di HP > Perangkat Tertaut > Tautkan Perangkat.\n');
            }
        }
        if (connection === 'open') {
            botStatus.state = 'connected';
            botStatus.qr = null;
            hasPrintedQR = false;
            botStatus.connectedAt = new Date().toISOString();
            if (sock.user?.id) {
                botStatus.phoneNumber = sock.user.id.split(':')[0];
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            console.log('\n' + '='.repeat(59));
            console.log(' [OK] BOT WHATSAPP SAPA BPS KAB. BANGKA AKTIF & TERHUBUNG! ');
            console.log('='.repeat(59));
            console.log(' [STATUS] Siap menerima dan membalas pesan secara otomatis.');
            console.log(' [TIPS] Coba kirim pesan "halo" atau "menu" ke nomor bot ini.\n');
        }
        if (connection === 'close') {
            botStatus.state = 'disconnected';
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode
                : (lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode || 0);
            if (statusCode === DisconnectReason.loggedOut ||
                statusCode === 401 ||
                statusCode === 440 ||
                statusCode === 408) {
                console.log(`[INFO] Sesi login tidak valid (${statusCode}). Membersihkan auth_info untuk membuat QR baru...`);
                try {
                    if (fs.existsSync(AUTH_DIR)) {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    }
                }
                catch (err) { }
            }
            if (!reconnectTimeout) {
                reconnectTimeout = setTimeout(() => {
                    reconnectTimeout = null;
                    startWhatsAppBot();
                }, 3000);
            }
        }
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Filter hanya pesan pribadi (abaikan grup @g.us, status/broadcast @broadcast, dan channel @newsletter)
        const privateMessages = messages.filter(msg => {
            const jid = msg.key?.remoteJid;
            if (!jid)
                return false;
            return !jid.endsWith('@g.us') && !jid.endsWith('@broadcast') && !jid.endsWith('@newsletter');
        });
        if (privateMessages.length === 0)
            return;
        await handleIncomingMessages(sock, privateMessages);
    });
    return sock;
}
