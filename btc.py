import base58
from ecdsa import SigningKey, SECP256k1
from Crypto.Hash import RIPEMD160
import hashlib
import threading

min_key = 0x2126875fd00000000
max_key = 0x3ffffffffffffffff

wallets = ['13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so']

def generate_public(private_key_hex):
    private_key_bytes = bytes.fromhex(private_key_hex)
    signing_key = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
    verifying_key = signing_key.get_verifying_key()
    public_key_bytes = b'\x04' + verifying_key.to_string()
    sha256_1 = hashlib.sha256(public_key_bytes).digest()
    ripemd160 = RIPEMD160.new(sha256_1).digest()
    network_byte = b'\x00' + ripemd160
    checksum = hashlib.sha256(hashlib.sha256(network_byte).digest()).digest()[:4]
    address = base58.b58encode(network_byte + checksum).decode('utf-8')
    return address

def worker(start_key, end_key, wallets):
    for key in range(start_key, end_key):
        pkey = hex(key)[2:].zfill(64)
        public = generate_public(pkey)
        
        print(f"Private Key: {pkey}")
        print(f"Public Address: {public}")
        
        if public in wallets:
            print(f"ACHEI!!!! 🎉🎉🎉🎉🎉 Private Key: {pkey}")
            with open('correspondencias.txt', 'a') as f:
                f.write(f"Wallet: {public}\nChave Privada: {pkey}\n\n")
            break

def run_with_threads():
    num_threads = 4  # Ajuste o número de threads conforme necessário
    key_range = (max_key - min_key) // num_threads
    threads = []
    for i in range(num_threads):
        start_key = min_key + i * key_range
        end_key = start_key + key_range
        t = threading.Thread(target=worker, args=(start_key, end_key, wallets))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

if __name__ == "__main__":
    run_with_threads()
