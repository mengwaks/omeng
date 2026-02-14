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
    console.log(chalk.white.bold('    🔥 OMENG ONE-SHOT EXPLOSION V8.0 🔥   '));
    console.log(chalk.yellow('      Group Bridge | Instant Delivery      '));
    console.log(chalk.red.bold('========================================='));
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
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false // Ghost Mode aktif
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

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                console.log(chalk.red.bold('\n❌ SESI MATI / TERBLOKIR!'));
                if (fs.existsSync(sessionName)) {
                    fs.rmSync(sessionName, { recursive: true, force: true });
                }
                process.exit(0);
            } else {
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
    console.log('\n[1] Mulai One-Shot Blast');
    console.log('[2] Logout & Hapus Sesi');
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
    console.log(chalk.yellow('\nKetik "EDIT" untuk benerin'));
    console.log(chalk.green('Ketik "GAS" untuk lanjut'));

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
    console.log(chalk.yellow('Langkah 2: PASTE NOMOR MEMBER'));
    console.log(chalk.gray('Tempel nomor, lalu ketik "GAS" untuk MELEDAKKAN!'));
    
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
    
    console.log(chalk.red.bold(`\n💥 PERSIAPAN MELEDAKKAN GRUP...`));
    for (let i = 5; i > 0; i--) {
        console.log(chalk.yellow(`   Detonasi dalam: ${i}...`));
        await delay(1000);
    }

    console.log(chalk.red.bold(`\n🔥 FIRE! SEDANG MEMBUAT JEMBATAN GRUP...`));

    const targets = blastData.numbers.map(n => n + '@s.whatsapp.net');
    const randomName = "INFO PENTING " + Math.random().toString(36).substring(7).toUpperCase();

    try {
        console.log(chalk.cyan(`\n[1/2] Menarik ${targets.length} nomor ke dalam grup sekaligus...`));
        
        // SATU REQUEST UNTUK SEMUA MEMBER
        const group = await sock.groupCreate(randomName, targets);
        
        console.log(chalk.green(`✅ Grup Berhasil: ${group.id}`));
        console.log(chalk.cyan(`[2/2] Melepaskan pesan toa ke dalam grup...`));

        // Kirim pesan UTAMA
        await sock.sendMessage(group.id, { text: blastData.message });

        console.log(chalk.bold.bgGreen.black('\n 💥 BOOM! PESAN SUDAH DITARUH DI GRUP! '));
        console.log(chalk.white('Target sudah dapet notifikasi. Cek HP lo!'));

    } catch (e) {
        console.log(chalk.red(`\n❌ EKSEKUSI GAGAL: ${e.message}`));
        console.log(chalk.gray(`Penyebab: Akun terlalu baru atau Meta membatasi 'Group Create'.`));
    }

    console.log(chalk.gray('\nTekan Enter buat balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

// Jalankan sistem
connectToWhatsApp();
