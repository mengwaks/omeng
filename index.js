const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const fs = require('fs'); // BUAT HAPUS FOLDER OTOMATIS

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
    console.log(chalk.cyan.bold('    ⚡ OMENG ULTIMATE BLASTER V6.0 ⚡    '));
    console.log(chalk.yellow('      Brutal Shotgun | Auto-Cleanup       '));
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

            // LOGIC AUTO-REMOVE FOLDER SESI (Request Lu)
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                console.log(chalk.red.bold('\n❌ SESI MATI / TERBLOKIR!'));
                console.log(chalk.white('MENGHAPUS FOLDER AUTH_SESSION OTOMATIS...'));
                
                if (fs.existsSync(sessionName)) {
                    fs.rmSync(sessionName, { recursive: true, force: true });
                }
                
                console.log(chalk.green('Sesi sudah dibersihkan. Silakan jalankan ulang script untuk QR baru.'));
                process.exit(0);
            } else {
                // Reconnect biasa kalau cuma gangguan sinyal
                setTimeout(() => connectToWhatsApp(), 5000);
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
    console.log('[2] Logout & Bersihkan Sesi');
    console.log('[3] Keluar Script');
    
    const input = await ask(chalk.cyan('\nPilih Menu > '));
    
    if (input === '1') {
        InputPesan();
    } else if (input === '2') {
        if (fs.existsSync(sessionName)) {
            fs.rmSync(sessionName, { recursive: true, force: true });
        }
        process.exit(0);
    } else if (input === '3') {
        process.exit(0);
    } else {
        MenuUtama();
    }
}

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
        await InputPesan();
    } else if (action.toUpperCase() === 'GAS') {
        InputNomor();
    } else {
        await KonfirmasiPesan();
    }
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2: PASTE NOMOR MEMBER'));
    console.log(chalk.gray('Tempel nomor, lalu ketik "GAS" untuk BRUTAL BURST!'));
    
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
    
    console.log(chalk.red.bold(`\n💥 MODE BRUTAL SHOTGUN: ON 💥`));
    console.log(chalk.yellow(`🚀 Menembak ${blastData.numbers.length} nomor secara SERENTAK...`));

    let sukses = 0;
    let gagal = 0;
    const targets = blastData.numbers;

    // BRUTAL LOGIC: Parallel tanpa antrean
    const tembakan = targets.map(async (num) => {
        try {
            // Gunakan return tanpa await di depan map biar dia lari serentak
            await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message });
            sukses++;
            process.stdout.write(chalk.green('🎯 ')); 
        } catch (e) {
            gagal++;
            process.stdout.write(chalk.red('💨 '));
        }
    });

    // Jalankan semua secara paralel
    await Promise.all(tembakan); 

    console.log(chalk.bold.bgGreen.black('\n\n ✅ SHOTGUN SELESAI DILEPAS! '));
    console.log(chalk.white(`==============================`));
    console.log(chalk.green(` BERHASIL : ${sukses} Nomor`));
    console.log(chalk.red(` GAGAL    : ${gagal} Nomor`));
    console.log(chalk.white(`==============================`));
    
    console.log(chalk.gray('\nTekan Enter buat balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
