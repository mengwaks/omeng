const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');

const sessionName = 'auth_session';
let sock;
let isConnected = false;
let isAuthenticating = false;

// 1. SATU READLINE GLOBAL
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true 
});

let blastData = { message: '', numbers: [] };

// Helper Tanya
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const showHeader = () => {
    // Header cuma muncul kalau gak lagi nunggu QR/Pairing
    if (isAuthenticating && !isConnected) return; 
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('    ⚡ OMENG ULTIMATE BLASTER V5 ⚡    '));
    console.log(chalk.yellow('      Ubuntu Bypass Mode | Stable UI      '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Chrome'),
        connectTimeoutMs: 60000,
        printQRInTerminal: false, // Kita handle manual biar gak berantakan
        syncFullHistory: false
    });

    // --- PROSES AUTHENTICATION (Hanya jika belum login) ---
    if (!sock.authState.creds.me) {
        isAuthenticating = true;
        showHeader();
        console.log(chalk.white('Silakan Login Terlebih Dahulu:'));
        console.log('[1] Scan QR Code');
        console.log('[2] Pairing Code');
        
        const choice = await ask(chalk.cyan('\nPilih (1/2) > '));

        if (choice === '1') {
            console.log(chalk.yellow('\nMenunggu QR Code dari server...'));
            // Listener QR khusus saat login
            const qrListener = (update) => {
                const { qr } = update;
                if (qr) {
                    console.clear();
                    console.log(chalk.green('SCAN QR INI DENGAN WA KAMU:\n'));
                    qrcode.generate(qr, { small: true });
                }
            };
            sock.ev.on('connection.update', qrListener);
        } else {
            const num = await ask(chalk.yellow('\nMasukkan Nomor WA (628xxx): '));
            const cleanNum = num.replace(/[^0-9]/g, '');
            if (cleanNum) {
                console.log(chalk.gray('\nMengambil kode... (Tunggu 10 detik)'));
                await delay(10000); 
                try {
                    let code = await sock.requestPairingCode(cleanNum);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green.bold('\n✅ KODE PAIRING: ') + chalk.bgGreen.black.bold(` ${code} `));
                } catch (e) {
                    console.log(chalk.red(`\n❌ Error: ${e.message}`));
                    process.exit(0);
                }
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            isConnected = false;
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                // Jangan panggil MenuUtama pas disconnect!
                connectToWhatsApp();
            } else {
                console.log(chalk.red('\nSesi Logout. Hapus folder auth_session!'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ TERHUBUNG! Mantap, Meng.'));
            // Kasih delay biar gak langsung ketimpa header menu
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

async function MenuUtama() {
    if (!isConnected) return;
    rl.removeAllListeners('line'); 
    showHeader();
    console.log(chalk.green('✅ Status: ONLINE'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    
    const input = await ask(chalk.cyan('\nPilih Menu > '));
    
    if (input === '1') {
        InputPesan();
    } else if (input === '2') {
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
        console.log(chalk.red('Pesan kosong!'));
        await delay(1500);
        MenuUtama();
    }
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2/2: PASTE NOMOR'));
    console.log(chalk.gray('Ketik "GAS" jika sudah selesai.'));
    
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
    console.log(chalk.yellow(`\n🔄 Meluncur ke ${blastData.numbers.length} nomor...`));
    
    for (const num of blastData.numbers) {
        try {
            await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message });
            console.log(chalk.green(`[✅] ${num} Terkirim`));
        } catch (e) {
            console.log(chalk.red(`[❌] ${num} Gagal`));
        }
        await delay(2000); 
    }

    console.log(chalk.bold('\nBERES! Tekan Enter buat balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

// Start
connectToWhatsApp();
