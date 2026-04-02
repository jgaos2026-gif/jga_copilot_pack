// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

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

