﻿const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
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
    searchInRange(start, end, wallets, workerId);
}

function searchInRange(start, end, wallets, workerId) {
    const logFrequency = 1000;
    let key = start;

    while (key <= end) {
        const pkey = key.toString(16).padStart(64, '0');
        const publicAddress = generatePublic(pkey);

        if (key % BigInt(logFrequency) === 0n) { // Corrigindo a operação de módulo para usar BigInt
            parentPort.postMessage({ found: false, message: `Worker ${workerId}: Chave Privada: ${pkey} - Endereço Público: ${publicAddress}` });
        }

        if (wallets.includes(publicAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${pkey}`, wallet: publicAddress, privateKey: pkey });
            break;
        }

        key += 1n;
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
