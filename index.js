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

// Helper Tanya (Gue pake ini buat menu biar gak stuck)
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const showHeader = () => {
    if (isAuthenticating) return; 
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
        keepAliveIntervalMs: 15000,
        syncFullHistory: false
    });

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
                } catch (e) {
                    console.log(chalk.red(`\n❌ Gagal: ${e.message}`));
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
            if (reason !== DisconnectReason.loggedOut) connectToWhatsApp();
            else process.exit(0);
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ BERHASIL LOGIN!'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

async function MenuUtama() {
    if (!isConnected || isAuthenticating) return;
    rl.removeAllListeners('line'); // Bersihin sisa enter
    showHeader();
    console.log(chalk.green('✅ Status: ONLINE'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    
    const input = await ask(chalk.cyan('\nPilih Menu > '));
    
    if (input === '1') {
        await InputPesan();
    } else if (input === '2') {
        process.exit(0);
    } else {
        MenuUtama(); // Kalo salah input balik lagi
    }
}

async function InputPesan() {
    showHeader();
    console.log(chalk.yellow('Langkah 1/2: TULIS PESAN'));
    const msg = await ask(chalk.cyan('Isi Pesan: '));
    
    if (msg.trim()) {
        blastData.message = msg;
        await InputNomor();
    } else {
        console.log(chalk.red('Pesan tidak boleh kosong!'));
        await delay(2000);
        MenuUtama();
    }
}

async function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2/2: PASTE NOMOR'));
    console.log(chalk.gray('Ketik "GAS" jika sudah selesai menempel nomor.'));
    
    // Pake listener line khusus buat paste nomor massal
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
    if (blastData.numbers.length === 0) {
        console.log(chalk.red('\nNomor kosong!'));
        await delay(2000);
        return MenuUtama();
    }

    console.log(chalk.yellow(`\n\n🔄 Meluncur ke ${blastData.numbers.length} nomor...`));
    
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

console.clear();
connectToWhatsApp();
