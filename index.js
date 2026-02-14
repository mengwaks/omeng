const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');

const sessionName = 'auth_session';
let sock;
let isConnected = false;
let isAuthenticating = false;

// 1. SATU READLINE GLOBAL (Anti-Ghosting & Double Listener)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true 
});

let blastData = { message: '', numbers: [] };

// Helper Tanya
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const showHeader = () => {
    if (isAuthenticating) return; // Kunci UI jika sedang login
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
        browser: Browsers.macOS('Chrome'), // Nyamar jadi user Mac biar aman
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        syncFullHistory: false
    });

    // --- PROSES AUTHENTICATION ---
    if (!sock.authState.creds.me) {
        isAuthenticating = true;
        showHeader();
        console.log(chalk.white('Pilih Metode Login:'));
        console.log('[1] Scan QR Code (Manual)');
        console.log('[2] Pairing Code (Nomor HP)');
        
        const choice = await ask(chalk.cyan('\nPilih (1/2) > '));

        if (choice === '1') {
            console.log(chalk.yellow('\nMenunggu QR Code...'));
            sock.ev.on('connection.update', (update) => {
                const { qr } = update;
                if (qr) {
                    console.clear();
                    console.log(chalk.green('SCAN QR INI DENGAN WHATSAPP KAMU:\n'));
                    qrcode.generate(qr, { small: true });
                    console.log(chalk.gray('\nQR akan kadaluarsa dlm 30 detik.'));
                }
            });
        } else {
            const num = await ask(chalk.yellow('\nMasukkan Nomor WA (cth: 628xxx): '));
            const cleanNum = num.replace(/[^0-9]/g, '');
            if (cleanNum) {
                console.log(chalk.gray('\nStabilitasi koneksi... (Tunggu 10 detik)'));
                await delay(10000); 
                try {
                    let code = await sock.requestPairingCode(cleanNum);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green.bold('\n✅ KODE PAIRING KAMU: ') + chalk.bgGreen.black.bold(` ${code} `));
                    console.log(chalk.white('\nBuka WA > Perangkat Tertaut > Masukkan kode di atas.'));
                } catch (e) {
                    console.log(chalk.red(`\n❌ Gagal: ${e.message}. Silakan restart script.`));
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
                console.log(chalk.red(`\nKoneksi Down (${reason}). Menyambung ulang...`));
                connectToWhatsApp();
            } else {
                console.log(chalk.red('\nSesi Logout. Hapus folder auth_session!'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ BERHASIL LOGIN! Mantap, Meng.'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

function MenuUtama() {
    if (!isConnected || isAuthenticating) return;
    rl.removeAllListeners('line'); // Reset listener
    showHeader();
    console.log(chalk.green('✅ Status: ONLINE'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    process.stdout.write(chalk.cyan('\nPilih Menu > '));

    rl.on('line', (line) => {
        const input = line.trim();
        if (input === '1') InputPesan();
        else if (input === '2') process.exit(0);
    });
}

function InputPesan() {
    rl.removeAllListeners('line');
    showHeader();
    console.log(chalk.yellow('Langkah 1/2: TULIS PESAN'));
    process.stdout.write(chalk.cyan('Pesan: '));
    rl.on('line', (line) => {
        const msg = line.trim();
        if (msg) {
            blastData.message = msg;
            InputNomor();
        }
    });
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2/2: PASTE NOMOR'));
    console.log(chalk.gray('Ketik "GAS" jika sudah selesai menempel nomor.'));
    
    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toUpperCase() === 'GAS') {
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
    rl.removeAllListeners('line');
    if (blastData.numbers.length === 0) return MenuUtama();

    console.log(chalk.yellow(`\n\n🔄 Meluncur ke ${blastData.numbers.length} nomor...`));
    
    for (const num of blastData.numbers) {
        try {
            await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message });
            console.log(chalk.green(`[✅] ${num} Terkirim`));
        } catch (e) {
            console.log(chalk.red(`[❌] ${num} Gagal`));
        }
        await delay(2000); // Jeda 2 detik antar pesan (Safety)
    }

    console.log(chalk.bold('\nBERES! Tekan Enter untuk kembali.'));
    rl.once('line', () => MenuUtama());
}

// Jalankan
console.clear();
connectToWhatsApp();
