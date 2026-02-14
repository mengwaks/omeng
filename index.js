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
    console.log(chalk.cyan.bold('    ⚡ OMENG ULTIMATE BLASTER V5.2 ⚡    '));
    console.log(chalk.yellow('      Shotgun Burst | Edit & Confirm      '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

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

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            isConnected = false;
            const statusCode = (lastDisconnect.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode 
                : lastDisconnect.error;

            console.log(chalk.yellow(`\n[!] Koneksi Terputus (Code: ${statusCode})`));

            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                console.log(chalk.red('\n❌ SESI LOGOUT. Scan ulang!'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            isConnected = true;
            isAuthenticating = false;
            console.log(chalk.green('\n✅ STATUS: ONLINE'));
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
        await sock.logout();
        process.exit(0);
    } else if (input === '3') {
        process.exit(0);
    } else {
        MenuUtama();
    }
}

// --- FUNGSI UPDATE SESUAI REQUEST LU ---

async function InputPesan() {
    showHeader();
    console.log(chalk.yellow('Langkah 1: TULIS PESAN'));
    const msg = await ask(chalk.cyan('Isi Pesan: '));
    
    if (msg.trim()) {
        blastData.message = msg;
        await KonfirmasiPesan();
    } else {
        MenuUtama();
    }
}

async function KonfirmasiPesan() {
    showHeader();
    console.log(chalk.white('--- REVIEW PESAN ---'));
    console.log(chalk.cyan(`"${blastData.message}"`));
    console.log(chalk.white('--------------------'));
    console.log(chalk.yellow('\nKetik "EDIT" untuk ganti kata-kata'));
    console.log(chalk.green('Ketik "GAS" untuk lanjut ke input nomor'));

    const action = await ask(chalk.bold('\nPilih (EDIT/GAS) > '));

    if (action.toUpperCase() === 'EDIT') {
        await InputPesan(); // Balik ke nanya pesan
    } else if (action.toUpperCase() === 'GAS') {
        InputNomor(); // Lanjut ke step input nomor
    } else {
        console.log(chalk.red('Perintah salah! Pilih EDIT atau GAS.'));
        await delay(1500);
        await KonfirmasiPesan();
    }
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2: PASTE NOMOR MEMBER'));
    console.log(chalk.gray('Tempel nomor, lalu ketik "GAS" untuk BURST!'));
    
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
    
    console.log(chalk.red.bold(`\n💥 SHOTGUN BURST MODE: ON 💥`));
    console.log(chalk.yellow(`🚀 Menembak ${blastData.numbers.length} nomor secara SERENTAK...`));

    const pesan = blastData.message;
    const targets = blastData.numbers;

    // SHOTGUN LOGIC (Parallel/Serentak 100%)
    const tembakan = targets.map((num) => {
        // Tembak tanpa 'await', biarkan semua peluru lepas barengan
        return sock.sendMessage(num + '@s.whatsapp.net', { text: pesan })
            .then(() => {
                process.stdout.write(chalk.green('🎯 ')); 
            })
            .catch(() => {
                process.stdout.write(chalk.red('💨 '));
            });
    });

    // Jalankan semua tembakan sekaligus dalam milidetik
    Promise.all(tembakan); 

    console.log(chalk.bold.bgGreen.black('\n\n ✅ SHOTGUN BERHASIL DILEPAS! '));
    console.log(chalk.white(`Semua ${targets.length} peluru sudah keluar dari script secara serentak.`));
    
    console.log(chalk.gray('\nTekan Enter buat balik ke menu utama.'));
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
