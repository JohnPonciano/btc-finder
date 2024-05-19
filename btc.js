const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const CoinKey = require('coinkey');
const fs = require('fs');

const wallets = [
    '14u4nA5sugaswb6SZgn5av2vuChdMnD9E5',
    '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so',
    '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9'
];

const ranges = [
    { min: BigInt('0x4000000000000000000000000000000000000000'), max: BigInt('0x7fffffffffffffffffffffffffffffffffffffff') },
    { min: BigInt('0x2000000000000000'), max: BigInt('0x3ffffffffffffffff') },
    { min: BigInt('0x4000000000000000'), max: BigInt('0x7ffffffffffffffff') }
];

const numWorkers = require('os').cpus().length;

if (isMainThread) {
    // Criar pool de workers
    const workerPool = [];
    for (let i = 0; i < numWorkers; i++) {
        const { min, max } = ranges[i % ranges.length]; // Distribuir os intervalos entre os workers
        const worker = new Worker(__filename, { workerData: { start: min, end: max, wallets, workerId: i + 1 } });
        workerPool.push(worker);

        worker.on('message', (msg) => {
            if (msg.found) {
                console.log(msg.message);
                saveToFile(msg.wallet, msg.privateKey); // Salvar em um arquivo quando uma correspondência for encontrada
                workerPool.forEach(worker => worker.terminate()); // Terminar todos os workers se uma correspondência for encontrada
            } else {
                console.log(msg.message);
            }
        });
    }
} else {
    const { start, end, wallets, workerId } = workerData;
    pollardsKangaroo(start, end, wallets, workerId);
}

function pollardsKangaroo(start, end, wallets, workerId) {
    const tameStart = (start + end) / 2n;
    const tameJump = (end - start) / 3n;
    const wildJump = tameJump;

    let tamePosition = tameStart;
    let wildPosition = start;
    const visitedPositions = new Map();

    console.log(`Worker ${workerId} iniciou com intervalo de ${start.toString(16)} a ${end.toString(16)}`);

    while (true) {
        // Movimentos do canguru domesticado
        let tameKey = tamePosition.toString(16).padStart(64, '0');
        let tameAddress = generatePublic(tameKey);
        console.log(`Worker ${workerId} (Tame): Posicao: ${tamePosition.toString(16)}, Chave: ${tameKey}, Endereco: ${tameAddress}`);
        if (wallets.includes(tameAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${tameKey}`, wallet: tameAddress, privateKey: tameKey });
            return;
        }
        visitedPositions.set(tameAddress, tameKey);
        tamePosition += tameJump;

        // Movimentos do canguru selvagem
        let wildKey = wildPosition.toString(16).padStart(64, '0');
        let wildAddress = generatePublic(wildKey);
        console.log(`Worker ${workerId} (Wild): Posicao: ${wildPosition.toString(16)}, Chave: ${wildKey}, Endereco: ${wildAddress}`);
        if (wallets.includes(wildAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${wildKey}`, wallet: wildAddress, privateKey: wildKey });
            return;
        }
        if (visitedPositions.has(wildAddress)) {
            let privateKey = visitedPositions.get(wildAddress);
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${privateKey}`, wallet: wildAddress, privateKey: privateKey });
            return;
        }
        wildPosition += wildJump;

        // Log de progresso
        if (wildPosition % (wildJump * 100n) === 0n) {
            console.log(`Worker ${workerId} progrediu para a posição ${wildPosition.toString(16)}`);
        }
    }
}

function generatePublic(privateKey) {
    const _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    _key.compressed = true;
    return _key.publicAddress;
}

function saveToFile(wallet, privateKey) {
    const data = `Wallet: ${wallet}\nChave Privada: ${privateKey}\n\n`;
    fs.appendFileSync('correspondencias.txt', data); // Adiciona os dados ao arquivo
}
