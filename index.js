const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');

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
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('    ⚡ OMENG ULTIMATE BLASTER V5.1 ⚡   '));
    console.log(chalk.yellow('      Anti-Logout | Auto-Reconnect       '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'), // Nyamar jadi Desktop biar lebih stabil
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // --- PROSES LOGIN ---
    if (!sock.authState.creds.me) {
        isAuthenticating = true;
        showHeader();
        console.log(chalk.white('Sesi Baru: Silakan Pilih Login'));
        console.log('[1] Scan QR Code');
        console.log('[2] Pairing Code');
        
        const choice = await ask(chalk.cyan('\nPilih (1/2) > '));

        if (choice === '1') {
            sock.ev.on('connection.update', (update) => {
                const { qr } = update;
                if (qr) {
                    console.clear();
                    console.log(chalk.green('SCAN QR INI SEGERA:\n'));
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
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green.bold('\n✅ KODE PAIRING: ') + chalk.bgGreen.black.bold(` ${code} `));
                } catch (e) {
                    console.log(chalk.red(`\n❌ Gagal: ${e.message}`));
                }
            }
        }
    }

    // WAJIB: Simpan tiap ada update kredensial
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            isConnected = false;
            // Ambil kode error kenapa dia putus
            const statusCode = (lastDisconnect.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode 
                : lastDisconnect.error;

            console.log(chalk.yellow(`\n[!] Koneksi Terputus (Code: ${statusCode})`));

            // Logic Reconnect Otomatis
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log(chalk.cyan('🔄 Mencoba menyambung ulang dalam 5 detik...'));
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                console.log(chalk.red('\n❌ SESI DIHAPUS OLEH WA. Scan ulang, Meng!'));
                // Jangan hapus manual, biar user yang rm -rf sendiri kalau perlu
                process.exit(0);
            }
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ STATUS: ONLINE & STABIL'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

async function MenuUtama() {
    if (!isConnected) return;
    rl.removeAllListeners('line'); 
    showHeader();
    console.log(chalk.green('✅ Akun: ' + sock.authState.creds.me.id.split(':')[0]));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Logout & Hapus Sesi');
    console.log('[3] Keluar Script');
    
    const input = await ask(chalk.cyan('\nPilih Menu > '));
    
    if (input === '1') {
        InputPesan();
    } else if (input === '2') {
        console.log(chalk.red('Menghapus sesi...'));
        await sock.logout();
        process.exit(0);
    } else if (input === '3') {
        process.exit(0);
    } else {
        MenuUtama();
    }
}

async function InputPesan() {
    showHeader();
    console.log(chalk.yellow('Langkah 1/2: TULIS PESAN'));
    const msg = await ask(chalk.cyan('Isi Pesan: '));
    if (msg.trim()) {
        blastData.message = msg;
        InputNomor();
    } else {
        MenuUtama();
    }
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2/2: PASTE NOMOR'));
    console.log(chalk.gray('Tempel nomor, lalu ketik "GAS" untuk kirim.'));
    
    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toUpperCase() === 'GAS') {
            rl.removeAllListeners('line');
            Eksekusi();
        } else {
            const n = input.replace(/[^0-9]/g, '');
            if (n.length > 5) {
                blastData.numbers.push(n);
                process.stdout.write(chalk.gray('.'));
            }
        }
    });
}

async function Eksekusi() {
    if (blastData.numbers.length === 0) return MenuUtama();
    showHeader();
    console.log(chalk.yellow(`\n🚀 Memulai Blast ke ${blastData.numbers.length} nomor...`));
    
    for (let i = 0; i < blastData.numbers.length; i++) {
        const num = blastData.numbers[i];
        try {
            // Cek koneksi sebelum kirim
            if (!isConnected) {
                console.log(chalk.red(`[!] Koneksi mati, nunggu nyambung lagi...`));
                while (!isConnected) await delay(2000);
            }

            await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message });
            console.log(chalk.green(`[${i+1}] ✅ ${num} Terkirim`));
        } catch (e) {
            console.log(chalk.red(`[${i+1}] ❌ ${num} Gagal: ${e.message}`));
        }
        // JEDA RANDOM (Penting biar gak dianggap spam)
        const jeda = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
        await delay(jeda); 
    }

    console.log(chalk.bold('\nSelesai! Tekan Enter buat balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
