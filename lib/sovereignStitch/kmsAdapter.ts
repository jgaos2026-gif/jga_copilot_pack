// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { promises as fs } from 'fs'
import { join } from 'path'

// Simple local-file KMS adapter for testing/demo only.
// Production should replace with real KMS (AWS KMS, GCP KMS, Azure Key Vault).

export class LocalKMS {
  baseDir: string
  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async ensure() {
    await fs.mkdir(this.baseDir, { recursive: true })
  }

  async putKey(keyId: string, pem: string) {
    await this.ensure()
    const p = join(this.baseDir, `${keyId}.pem`)
    await fs.writeFile(p, pem, 'utf8')
    return p
  }

  async getKey(keyId: string) {
    const p = join(this.baseDir, `${keyId}.pem`)
    const raw = await fs.readFile(p, 'utf8')
    return raw
  }

  async hasKey(keyId: string) {
    try {
      await fs.access(join(this.baseDir, `${keyId}.pem`))
      return true
    } catch {
      return false
    }
  }
}
