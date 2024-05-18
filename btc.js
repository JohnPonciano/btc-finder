const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const CoinKey = require('coinkey');

const wallets = ['14u4nA5sugaswb6SZgn5av2vuChdMnD9E5'];
const min = BigInt('0x4000000000000000000000000000000000000000');
const max = BigInt('0x7fffffffffffffffffffffffffffffffffffffff');
const numWorkers = 4; // Number of worker threads to use

if (isMainThread) {
    let rangeSize = (max - min) / BigInt(numWorkers);
    for (let i = 0; i < numWorkers; i++) {
        let start = min + rangeSize * BigInt(i);
        let end = (i === numWorkers - 1) ? max : start + rangeSize - BigInt(1);

        const worker = new Worker(__filename, { workerData: { start, end, wallets, workerId: i + 1 } });
        worker.on('message', (msg) => {
            if (msg.found) {
                console.log(msg.message);
                process.exit(); // Exit main process if a match is found
            } else {
                console.log(msg.message);
            }
        });
    }
} else {
    let { start, end, wallets, workerId } = workerData;
    searchInRange(start, end, wallets, workerId);
}

function searchInRange(start, end, wallets, workerId) {
    let key = start;
    while (key <= end) {
        let pkey = key.toString(16).padStart(64, '0');
        let publicAddress = generatePublic(pkey);
        parentPort.postMessage({ found: false, message: `Worker ${workerId}: Chave Privada: ${pkey} - Endereço Público: ${publicAddress}` });
        if (wallets.includes(publicAddress)) {
            parentPort.postMessage({ found: true, message: `ACHEI!!!! :D Worker ${workerId} encontrou! Chave Privada: ${pkey}` });
            break;
        }
        key += 1n;
    }
}

function generatePublic(privateKey) {
    let _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    _key.compressed = true;
    return _key.publicAddress;
}
