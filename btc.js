const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const CoinKey = require('coinkey');
const fs = require('fs');

// Classe para implementar LRU Cache
class LRUCache {
    constructor(limit = 1000) {
        this.cache = new Map();
        this.limit = limit;
    }

    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

// Lista de carteiras alvo
const wallets = [
    '1CMq3SvFcVEcpLMuuH8PUcNiqsK1oicG2D',
];

// Intervalo de chaves privadas possíveis
const minRange = BigInt('0x800000000000000000000'); // 2^83
const maxRange = BigInt('0xfffffffffffffffffffff'); // 2^84 - 1

const numWorkers = require('os').cpus().length;
const rangeSize = (maxRange - minRange) / BigInt(numWorkers * 10); // Dividindo em mais segmentos para paralelismo

if (isMainThread) {
    // Criar pool de workers
    const workerPool = [];
    for (let i = 0; i < numWorkers; i++) {
        const start = minRange + rangeSize * BigInt(i) * BigInt(10); // Saltos menores
        const end = (i === numWorkers - 1) ? maxRange : start + rangeSize - 1n; // Ajustar o último intervalo

        const worker = new Worker(__filename, { workerData: { start, end, wallets, workerId: i + 1 } });
        workerPool.push(worker);

        worker.on('message', (msg) => {
            if (msg.found) {
                console.log(msg.message);
                saveToFile(msg.wallet, msg.privateKey);
                workerPool.forEach(worker => worker.terminate());
            } else {
                console.log(msg.message);
            }
        });

        worker.on('error', (err) => {
            console.error(`Worker ${i + 1} encountered an error:`, err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker ${i + 1} stopped with exit code ${code}`);
            }
        });
    }

    process.on('exit', () => saveToFileInBatch()); // Salva qualquer resultado pendente no final da execução
} else {
    const { start, end, wallets, workerId } = workerData;
    pollardsKangaroo(start, end, wallets, workerId);
}

// Função principal do worker
function pollardsKangaroo(start, end, wallets, workerId) {
    const tameStart = (start + end) / 2n;
    const tameJump = (end - start) / 3n;
    const wildJump = tameJump;

    let tamePosition = tameStart;
    let wildPosition = start;
    let visitedPositions = new LRUCache(1000);
    let cache = [];

    console.log(`Worker ${workerId} iniciou com intervalo de ${start.toString(16)} a ${end.toString(16)}`);

    while (true) {
        // Movimentos do canguru domesticado
        let tameKey = tamePosition.toString(16).padStart(64, '0');
        let tameAddress = generatePublic(tameKey);
        console.log(`Worker ${workerId} (Tame): Posicao: ${tamePosition.toString(16)}, Chave: ${tameKey}, Endereco: ${tameAddress}`);
        if (wallets.includes(tameAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${tameKey}`, wallet: tameAddress, privateKey: tameKey });
            results.push(`Wallet: ${tameAddress}\nChave Privada: ${tameKey}\n\n`);
            if (results.length > 10) saveToFileInBatch(); // Salvar em lote
            return;
        }
        visitedPositions.set(tameAddress, tameKey);
        cache.push(tameAddress);
        tamePosition += tameJump;

        // Movimentos do canguru selvagem
        let wildKey = wildPosition.toString(16).padStart(64, '0');
        let wildAddress = generatePublic(wildKey);
        console.log(`Worker ${workerId} (Wild): Posicao: ${wildPosition.toString(16)}, Chave: ${wildKey}, Endereco: ${wildAddress}`);
        if (wallets.includes(wildAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${wildKey}`, wallet: wildAddress, privateKey: wildKey });
            results.push(`Wallet: ${wildAddress}\nChave Privada: ${wildKey}\n\n`);
            if (results.length > 10) saveToFileInBatch(); // Salvar em lote
            return;
        }
        let privateKey = visitedPositions.get(wildAddress);
        if (privateKey) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${privateKey}`, wallet: wildAddress, privateKey: privateKey });
            results.push(`Wallet: ${wildAddress}\nChave Privada: ${privateKey}\n\n`);
            if (results.length > 10) saveToFileInBatch(); // Salvar em lote
            return;
        }
        wildPosition += wildJump;

        // Log de progresso
        if (wildPosition % (wildJump * 100n) === 0n) {
            console.log(`Worker ${workerId} progrediu para a posição ${wildPosition.toString(16)}`);
        }
    }
}

// Função para gerar o endereço público a partir de uma chave privada
function generatePublic(privateKey) {
    const _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    _key.compressed = true;
    return _key.publicAddress;
}

// Array para acumular resultados
const results = [];

// Função para salvar resultados em lote
function saveToFileInBatch() {
    if (results.length === 0) return;
    const data = results.join('\n');
    fs.appendFileSync('correspondencias.txt', data);
    results.length = 0; // Limpar resultados após salvar
}
