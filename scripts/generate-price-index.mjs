#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const DATA_RAW_DIR = path.join(ROOT, '.', 'raw-data')
const PRICE_DIR = path.join(DATA_RAW_DIR, 'price-data')
const INDEX_FILE = path.join(PRICE_DIR, 'index.json')

async function run() {
  try {
    const entries = await fs.readdir(PRICE_DIR, { withFileTypes: true })
    const files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, 'en'))

    if (files.length === 0) {
      console.warn('[generate-price-index] No JSON files found in data-raw/price-data')
    }

    const json = JSON.stringify(files, null, 2) + '\n'
    let shouldWrite = true

    try {
      const existing = await fs.readFile(INDEX_FILE, 'utf8')
      if (existing === json) {
        shouldWrite = false
        console.log('[generate-price-index] index.json up to date, no changes')
      }
    } catch {
      // Missing file is fine; we'll create it below.
    }

    if (shouldWrite) {
      await fs.writeFile(INDEX_FILE, json, 'utf8')
      console.log(`[generate-price-index] Wrote index.json with ${files.length} entries`)
    }
  } catch (error) {
    console.error('[generate-price-index] Failed:', error)
    process.exitCode = 1
  }
}

run()
