#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const DATA_RAW_DIR = path.join(ROOT, '.', 'raw-data')
const PUBLIC_DIR = path.join(ROOT, 'public')

const METER_DIR = path.join(DATA_RAW_DIR, 'meter-data')
const SOLAR_DIR = path.join(DATA_RAW_DIR, 'solar-data')
const PRICE_DIR = path.join(DATA_RAW_DIR, 'price-data')
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'combined-data')

/**
 * Round to 5 decimal places
 */
function round5(value) {
  return Math.round(value * 100000) / 100000
}

/**
 * Process a single month
 */
async function processMonth(year, month) {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  console.log(`Processing ${yearMonth}...`)

  // Read meter data (master source)
  const meterFile = path.join(METER_DIR, `${yearMonth}-meter.json`)
  let meterData
  try {
    const content = await fs.readFile(meterFile, 'utf8')
    meterData = JSON.parse(content)
  } catch (err) {
    console.warn(`⚠️  ${yearMonth}: Meter data not found, skipping`)
    return null
  }

  // Read solar data
  const solarFile = path.join(SOLAR_DIR, `${yearMonth}_60min.json`)
  let solarData = []
  try {
    const content = await fs.readFile(solarFile, 'utf8')
    solarData = JSON.parse(content)
  } catch (err) {
    console.warn(`⚠️  ${yearMonth}: Solar data not found, will use zeros`)
  }

  // Read price data
  const priceFile = path.join(PRICE_DIR, `${yearMonth}-price.json`)
  let priceData = []
  try {
    const content = await fs.readFile(priceFile, 'utf8')
    priceData = JSON.parse(content)
  } catch (err) {
    console.warn(`⚠️  ${yearMonth}: Price data not found, prices will be null`)
  }

  // Create maps for fast lookup by time
  const solarMap = new Map()
  for (const point of solarData) {
    solarMap.set(point.time, point.value ?? 0)
  }

  const priceMap = new Map()
  for (const point of priceData) {
    priceMap.set(point.time, point.price)
  }

  // Process each meter row (master source)
  const combinedData = []
  for (const meterPoint of meterData) {
    const time = meterPoint.time
    const meterIn = meterPoint.in ?? 0
    const meterInNet = meterPoint.in_net
    const meterOut = meterPoint.out ?? 0
    const meterOutNet = meterPoint.out_net

    // Get solar value (Wh) and convert to kWh
    const solarValueWh = solarMap.get(time) ?? 0
    const pv_raw = solarValueWh / 1000

    // Calculate self-consumption without tolerance.
    // Keep old tolerance block commented for quick rollback if needed.
    let self_cons_raw = pv_raw - meterOut

    // Tolerance for measurement/rounding errors (disabled):
    // if (self_cons_raw < 0 && self_cons_raw > -0.02) {
    //   self_cons_raw = 0
    // } else {
    //   self_cons_raw = Math.max(0, self_cons_raw)
    // }
    self_cons_raw = Math.max(0, self_cons_raw)

    // Calculate total consumption
    const tot_cons_raw = meterIn + self_cons_raw

    // Calculate saved consumption (energy saved due to solar panels)
    const saved_cons_raw = tot_cons_raw - (meterInNet ?? meterIn)

    // Get price (may be null)
    const price = priceMap.get(time) ?? null

    // Round calculated values to 5 decimals
    const pv = round5(pv_raw)
    const self_cons = round5(self_cons_raw)
    const tot_cons = round5(tot_cons_raw)
    const saved_cons = round5(saved_cons_raw)

    combinedData.push({
      time,
      in: meterIn,
      in_net: meterInNet,
      out: meterOut,
      out_net: meterOutNet,
      pv,
      price,
      self_cons,
      tot_cons,
      saved_cons
    })
  }

  return { yearMonth, data: combinedData }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Generating combined data ===\n')

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  // Read meter data index to know which months to process
  const meterIndexFile = path.join(METER_DIR, 'index.json')
  let meterFiles = []
  try {
    const content = await fs.readFile(meterIndexFile, 'utf8')
    meterFiles = JSON.parse(content)
  } catch (err) {
    console.error('❌ Failed to read meter-data/index.json')
    process.exitCode = 1
    return
  }

  // Extract year-month from meter files
  const months = []
  for (const fileName of meterFiles) {
    const match = fileName.match(/^(\d{4})-(\d{2})-meter\.json$/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      months.push({ year, month })
    }
  }

  if (months.length === 0) {
    console.error('❌ No meter data files found')
    process.exitCode = 1
    return
  }

  console.log(`Found ${months.length} month(s) to process\n`)

  // Process each month
  const outputFiles = []
  let processedCount = 0
  
  for (const { year, month } of months) {
    const result = await processMonth(year, month)
    if (result) {
      const { yearMonth, data } = result
      const outputFile = path.join(OUTPUT_DIR, `${yearMonth}-combined.json`)
      await fs.writeFile(outputFile, JSON.stringify(data, null, 2), 'utf8')
      outputFiles.push(`${yearMonth}-combined.json`)
      processedCount++
      console.log(`✅ ${yearMonth}: Wrote ${data.length} rows`)
    }
  }

  // Generate index.json
  outputFiles.sort()
  const indexFile = path.join(OUTPUT_DIR, 'index.json')
  await fs.writeFile(indexFile, JSON.stringify(outputFiles, null, 2), 'utf8')
  console.log(`\n✅ Generated index.json with ${outputFiles.length} file(s)`)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Successfully processed ${processedCount} month(s)`)
  console.log(`📁 Output: ${OUTPUT_DIR}`)
}

main()
