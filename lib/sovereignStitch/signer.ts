import { generateKeyPairSync, createSign, createVerify } from 'crypto'

export type KeyPair = {
  publicKey: string
  privateKey: string
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { publicKey, privateKey }
}

export function signData(privateKeyPem: string, data: string | Buffer): string {
  const sign = createSign('sha256')
  sign.update(data)
  sign.end()
  return sign.sign(privateKeyPem, 'base64')
}

export function verifyData(publicKeyPem: string, data: string | Buffer, signature: string): boolean {
  const verify = createVerify('sha256')
  verify.update(data)
  verify.end()
  return verify.verify(publicKeyPem, signature, 'base64')
}

