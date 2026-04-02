// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { createHash } from 'crypto'

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function merkleRoot(hashes: string[]): string | null {
  if (!hashes || hashes.length === 0) return null
  let level = hashes.slice()
  while (level.length > 1) {
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        next.push(sha256(level[i] + level[i + 1]))
      } else {
        // duplicate last when odd
        next.push(sha256(level[i] + level[i]))
      }
    }
    level = next
  }
  return level[0]
}
