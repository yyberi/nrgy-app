#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const DATA_RAW_DIR = path.join(ROOT, '.', 'raw-data')
const SOLAR_DIR = path.join(DATA_RAW_DIR, 'solar-data')
const INDEX_FILE = path.join(SOLAR_DIR, 'index.json')

async function run() {
  try {
    const entries = await fs.readdir(SOLAR_DIR, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && /\.json$/i.test(e.name) && e.name !== 'index.json')
      .map(e => e.name)
      .sort((a,b) => a.localeCompare(b, 'en'))

    if (files.length === 0) {
      console.warn('[generate-solar-index] No JSON files found in data-raw/solar-data')
    }

    const json = JSON.stringify(files, null, 2) + '\n'
    let needWrite = true
    try {
      const existing = await fs.readFile(INDEX_FILE, 'utf8')
      if (existing === json) {
        needWrite = false
        console.log('[generate-solar-index] index.json up to date, no changes')
      }
    } catch { /* ignore */ }

    if (needWrite) {
      await fs.writeFile(INDEX_FILE, json, 'utf8')
      console.log(`[generate-solar-index] Wrote index.json with ${files.length} entries`) 
    }
  } catch (err) {
    console.error('[generate-solar-index] Failed:', err)
    process.exitCode = 1
  }
}

run()
