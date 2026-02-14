const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const fs = require('fs'); 

const sessionName = 'auth_session';
let sock;
let isConnected = false;
let isAuthenticating = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true 
});

let blastData = { message: '', numbers: [] };

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const showHeader = () => {
    if (isAuthenticating && !isConnected) return; 
    console.clear();
    console.log(chalk.red.bold('========================================='));
    console.log(chalk.white.bold('    ⚡ OMENG SHADOW SYNC V10.0 ⚡    '));
    console.log(chalk.yellow('      Airplane Mode Hack | Chrome Ubuntu  '));
    console.log(chalk.red.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        // BYPASS: Nyamar jadi Chrome di Ubuntu biar Meta lebih percaya
        browser: Browsers.ubuntu('Chrome'), 
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false // Ghost Mode: Gak pamer status Online
    });

    if (!sock.authState.creds.me) {
        isAuthenticating = true;
        showHeader();
        console.log(chalk.white('Sesi Baru: Silakan Pilih Login'));
        console.log('[1] Scan QR Code\n[2] Pairing Code');
        const choice = await ask(chalk.cyan('\nPilih (1/2) > '));

        if (choice === '1') {
            sock.ev.on('connection.update', (update) => {
                const { qr } = update;
                if (qr) {
                    console.clear();
                    qrcode.generate(qr, { small: true });
                }
            });
        } else {
            const num = await ask(chalk.yellow('\nMasukkan Nomor (628xxx): '));
            const cleanNum = num.replace(/[^0-9]/g, '');
            if (cleanNum) {
                await delay(5000); 
                try {
                    let code = await sock.requestPairingCode(cleanNum);
                    console.log(chalk.green.bold('\n✅ KODE PAIRING: ') + chalk.bgGreen.black.bold(` ${code} `));
                } catch (e) {
                    console.log(chalk.red(`\n❌ Gagal: ${e.message}`));
                }
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : lastDisconnect.error;
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                console.log(chalk.red.bold('\n❌ SESI MATI / TERBLOKIR!'));
                if (fs.existsSync(sessionName)) fs.rmSync(sessionName, { recursive: true, force: true });
                process.exit(0);
            } else { setTimeout(() => connectToWhatsApp(), 5000); }
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ STATUS: ONLINE & GHOST MODE'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

async function MenuUtama() {
    if (!isConnected) return;
    rl.removeAllListeners('line'); 
    showHeader();
    console.log(chalk.green('✅ Akun: ' + sock.authState.creds.me.id.split(':')[0]));
    console.log('\n[1] Mulai Shadow Sync Blast\n[2] Logout & Hapus Sesi\n[3] Keluar');
    const input = await ask(chalk.cyan('\nPilih Menu > '));
    if (input === '1') InputPesan();
    else if (input === '2') { if (fs.existsSync(sessionName)) fs.rmSync(sessionName, { recursive: true, force: true }); process.exit(0); }
    else if (input === '3') process.exit(0);
    else MenuUtama();
}

async function InputPesan() {
    showHeader();
    const msg = await ask(chalk.yellow('Langkah 1: TULIS PESAN\n') + chalk.cyan('Isi: '));
    if (msg.trim()) { blastData.message = msg; await KonfirmasiPesan(); }
    else MenuUtama();
}

async function KonfirmasiPesan() {
    showHeader();
    console.log(chalk.white('--- REVIEW PESAN ---\n') + chalk.cyan(`"${blastData.message}"`) + chalk.white('\n--------------------'));
    const action = await ask(chalk.yellow('\nKetik "EDIT" benerin, atau "GAS" lanjut\nPilih > '));
    if (action.toUpperCase() === 'EDIT') await InputPesan();
    else if (action.toUpperCase() === 'GAS') InputNomor();
    else await KonfirmasiPesan();
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.yellow('Langkah 2: PASTE NOMOR MEMBER\n') + chalk.gray('Ketik "GAS" untuk JEBRET!'));
    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toUpperCase() === 'GAS') { rl.removeAllListeners('line'); Eksekusi(); }
        else {
            const n = input.replace(/[^0-9]/g, '');
            if (n.length > 5) { blastData.numbers.push(n); process.stdout.write(chalk.gray('.')); }
        }
    });
}

async function Eksekusi() {
    if (blastData.numbers.length === 0) return MenuUtama();
    showHeader();
    
    console.log(chalk.red.bold(`\n📡 MODE SHADOW SYNC: AKTIF 📡`));
    console.log(chalk.yellow(`🚀 Priming metadata untuk ${blastData.numbers.length} nomor...`));

    const targets = blastData.numbers;
    const antrean = [];

    // --- LANGKAH 1: PRIMING (Simulasi Buka Chat 1 per 1) ---
    for (let i = 0; i < targets.length; i++) {
        const jid = targets[i] + '@s.whatsapp.net';
        const randomID = Math.random().toString(36).substring(7);
        
        antrean.push({ jid, text: `${blastData.message}\n\n_${randomID}_` });
        
        // Kirim status 'ngetik' ke tiap nomor (Tanpa nunggu/await)
        sock.sendPresenceUpdate('composing', jid); 
        process.stdout.write(chalk.gray('.'));
    }

    console.log(chalk.green(`\n\n✅ ${antrean.length} Paket sudah di-buffer di memori.`));
    console.log(chalk.red.bold(`💥 JEBRET DALAM 3 DETIK...`));
    await delay(3000);

    // --- LANGKAH 2: THE MASSIVE FLUSH ---
    console.log(chalk.red.bold(`\n🔥 FIRE! SINKRONISASI MASSAL DIMULAI! 🔥`));

    let sukses = 0;
    let gagal = 0;

    const tembakan = antrean.map((item) => {
        return sock.sendMessage(item.jid, { text: item.text })
            .then(() => { sukses++; })
            .catch(() => { gagal++; });
    });

    // Simulasi 'Nyalain Data' - Semua paket dilepas serentak
    Promise.all(tembakan); 

    console.log(chalk.bold.bgGreen.black('\n ✅ SEMUA DATA SUDAH DIPOMPA KE SERVER! '));
    await delay(5000);

    console.log(chalk.white(`==============================`));
    console.log(chalk.green(` LOLOS GERBANG : ${sukses} Nomor`));
    console.log(chalk.red(` GAGAL / BLOCK  : ${gagal} Nomor`));
    console.log(chalk.white(`==============================`));
    
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
