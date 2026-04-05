#!/usr/bin/env node
import { promises as fs } from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const DATA_RAW_DIR = path.join(ROOT, '.', 'raw-data')
const COMBINED_DATA_DIR = path.join(ROOT, 'public', 'combined-data')

async function validateCombinedEnergyBalance() {
  console.log('\n=== Validating combined-data energy balance ===')

  try {
    const entries = await fs.readdir(COMBINED_DATA_DIR, { withFileTypes: true })
    const combinedFiles = entries
      .filter(e => e.isFile() && /^\d{4}-\d{2}-combined\.json$/i.test(e.name))
      .map(e => e.name)
      .sort()

    if (combinedFiles.length === 0) {
      console.warn('⚠️  No combined-data files found, skipping balance validation')
      return 0
    }

    const epsilon = 1e-6
    const sampleLimit = 25
    const samples = []
    let errorCount = 0
    const errorsByYear = new Map()

    for (const fileName of combinedFiles) {
      const filePath = path.join(COMBINED_DATA_DIR, fileName)
      const content = await fs.readFile(filePath, 'utf8')
      const rows = JSON.parse(content)

      if (!Array.isArray(rows)) {
        console.error(`❌ ${fileName}: Not an array`)
        errorCount += 1
        continue
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const out = typeof row.out === 'number' ? row.out : 0
        const pv = typeof row.pv === 'number' ? row.pv : 0
        const selfCons = typeof row.self_cons === 'number' ? row.self_cons : 0

        // For a valid hourly balance, grid export cannot exceed PV production for the same interval.
        if (out > pv + epsilon) {
          errorCount += 1
          const year = typeof row.time === 'string' ? row.time.slice(0, 4) : 'unknown'
          errorsByYear.set(year, (errorsByYear.get(year) ?? 0) + 1)

          if (samples.length < sampleLimit) {
            samples.push({
              fileName,
              index: i,
              time: row.time ?? '(missing time)',
              out,
              pv,
              selfCons,
              delta: out - pv
            })
          }
        }
      }
    }

    if (errorCount === 0) {
      console.log(`✅ Combined-data energy balance OK (${combinedFiles.length} file(s))`)
      return 0
    }

    console.error(`❌ Found ${errorCount} combined-data row(s) where out > pv`)
    console.error('   Sample timestamps (time | out | pv | self_cons | delta):')
    for (const sample of samples) {
      console.error(
        `   - ${sample.time} | out=${sample.out} | pv=${sample.pv} | self_cons=${sample.selfCons} | delta=${sample.delta.toFixed(6)} (${sample.fileName}, row ${sample.index + 1})`
      )
    }

    const yearlySummary = Array.from(errorsByYear.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => `${year}: ${count}`)
      .join(', ')

    if (yearlySummary) {
      console.error(`   Year summary: ${yearlySummary}`)
    }

    return errorCount
  } catch (err) {
    console.error('Failed to validate combined-data energy balance:', err)
    return 1
  }
}

async function normalizePriceData() {
  console.log('\n=== Normalizing price-data ===')
  const dataDir = path.join(DATA_RAW_DIR, 'price-data')
  
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true })
    const jsonFiles = entries
      .filter(e => e.isFile() && /\.json$/i.test(e.name) && e.name !== 'index.json')
      .map(e => e.name)
      .sort()

    let modifiedCount = 0
    for (const fileName of jsonFiles) {
      const filePath = path.join(dataDir, fileName)
      const content = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(content)

      if (!Array.isArray(data)) {
        console.error(`❌ ${fileName}: Not an array, skipping`)
        continue
      }

      let fileModified = false
      const normalizedData = data.map(point => {
        const normalized = { ...point }
        
        // Rename timestamp to time
        if ('timestamp' in normalized) {
          normalized.time = normalized.timestamp
          delete normalized.timestamp
          fileModified = true
        }
        
        // Round price to 3 decimals
        if ('price' in normalized && typeof normalized.price === 'number') {
          const rounded = Math.round(normalized.price * 1000) / 1000
          if (rounded !== normalized.price) {
            normalized.price = rounded
            fileModified = true
          }
        }
        
        return normalized
      })

      if (fileModified) {
        await fs.writeFile(filePath, JSON.stringify(normalizedData, null, 2), 'utf8')
        console.log(`✅ ${fileName}: Normalized`)
        modifiedCount++
      } else {
        console.log(`⏭️  ${fileName}: Already normalized`)
      }
    }

    console.log(`\n✅ Normalized ${modifiedCount} file(s)`)
    return 0

  } catch (err) {
    console.error('Failed to normalize price-data:', err)
    return 1
  }
}

async function validateDataset(datasetType, fieldName) {
  console.log(`\n=== Validating ${datasetType} ===`)
  const dataDir = path.join(DATA_RAW_DIR, datasetType)
  
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true })
    const jsonFiles = entries
      .filter(e => e.isFile() && /\.json$/i.test(e.name) && e.name !== 'index.json')
      .map(e => e.name)
      .sort()

    let totalErrors = 0
    for (const fileName of jsonFiles) {
      const filePath = path.join(dataDir, fileName)
      const content = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(content)

      if (!Array.isArray(data)) {
        console.error(`❌ ${fileName}: Not an array`)
        totalErrors++
        continue
      }

      const errors = []
      
      // Check for missing timestamps/time field
      const missingField = []
      const invalidDate = []
      const nullValues = []
      let prevTime = null

      for (let i = 0; i < data.length; i++) {
        const point = data[i]
        
        if (!point[fieldName]) {
          missingField.push(i)
          continue
        }

        const timestamp = new Date(point[fieldName]).getTime()
        if (isNaN(timestamp)) {
          invalidDate.push({ index: i, value: point[fieldName] })
        }

        // Check for time going backwards
        if (prevTime !== null && timestamp < prevTime) {
          errors.push(`Index ${i}: Time goes backwards (${point[fieldName]})`)
        }
        prevTime = timestamp

        // Check for null values in data fields
        const valueFields = Object.keys(point).filter(k => k !== fieldName && k !== 'time' && k !== 'timestamp')
        for (const vf of valueFields) {
          if (point[vf] === null || point[vf] === undefined) {
            nullValues.push({ index: i, field: vf })
          }
        }
      }

      if (missingField.length > 0) {
        errors.push(`Missing '${fieldName}' field at indices: ${missingField.slice(0, 5).join(', ')}${missingField.length > 5 ? '...' : ''} (${missingField.length} total)`)
      }

      if (invalidDate.length > 0) {
        errors.push(`Invalid date format at indices: ${invalidDate.slice(0, 3).map(x => `${x.index}:${x.value}`).join(', ')}${invalidDate.length > 3 ? '...' : ''} (${invalidDate.length} total)`)
      }

      if (nullValues.length > 0 && nullValues.length < 10) {
        // Don't report net field nulls as errors (expected for early data)
        const nonNetNulls = nullValues.filter(x => !x.field.includes('_net'))
        if (nonNetNulls.length > 0) {
          errors.push(`Null values in primary fields: ${nonNetNulls.map(x => `i${x.index}:${x.field}`).join(', ')}`)
        }
      } else if (nullValues.length >= 10) {
        const nonNetNulls = nullValues.filter(x => !x.field.includes('_net'))
        if (nonNetNulls.length > 0) {
          errors.push(`${nonNetNulls.length} null values in primary fields`)
        }
      }

      if (errors.length > 0) {
        console.error(`❌ ${fileName}:`)
        errors.forEach(err => console.error(`   ${err}`))
        totalErrors += errors.length
      } else {
        console.log(`✅ ${fileName}: OK (${data.length} points)`)
      }
    }

    if (totalErrors === 0) {
      console.log(`\n✅ All ${datasetType} files valid!`)
    } else {
      console.error(`\n❌ Found ${totalErrors} error(s) in ${datasetType}`)
    }
    return totalErrors

  } catch (err) {
    console.error(`Failed to validate ${datasetType}:`, err)
    return 1
  }
}

async function main() {
  // First normalize price-data
  const normalizeErrors = await normalizePriceData()
  if (normalizeErrors !== 0) {
    console.error('❌ Normalization failed')
    process.exitCode = 1
    return
  }

  // Then validate all datasets
  let totalErrors = 0
  
  totalErrors += await validateDataset('price-data', 'time')
  totalErrors += await validateDataset('solar-data', 'time')
  totalErrors += await validateDataset('meter-data', 'time')

  console.log(`\n${'='.repeat(50)}`)
  if (totalErrors === 0) {
    console.log('✅ All datasets valid!')
    
    // Generate index files if validation passed
    console.log('\n=== Generating index files ===')
    
    const indexScripts = [
      'generate-price-index.mjs',
      'generate-solar-index.mjs',
      'generate-meter-index.mjs'
    ]
    
    for (const script of indexScripts) {
      console.log(`\nRunning ${script}...`)
      const result = spawnSync('node', [path.join('scripts', script)], {
        stdio: 'inherit',
        cwd: ROOT
      })
      
      if (result.status !== 0) {
        console.error(`❌ ${script} failed with exit code ${result.status}`)
        process.exitCode = 1
        return
      }
    }
    
    console.log('\n✅ All index files generated successfully!')
    
    // Generate combined data
    console.log('\n=== Generating combined data ===')
    console.log('\nRunning generate-combined-data.mjs...')
    const combinedResult = spawnSync('node', [path.join('scripts', 'generate-combined-data.mjs')], {
      stdio: 'inherit',
      cwd: ROOT
    })
    
    if (combinedResult.status !== 0) {
      console.error(`❌ generate-combined-data.mjs failed with exit code ${combinedResult.status}`)
      process.exitCode = 1
      return
    }
    
    console.log('\n✅ Combined data generated successfully!')

    // Validate generated combined rows and print sample timestamps if balance issues are found.
    const combinedBalanceErrors = await validateCombinedEnergyBalance()
    if (combinedBalanceErrors !== 0) {
      process.exitCode = 1
      return
    }
  } else {
    console.error(`❌ Total errors found: ${totalErrors}`)
    process.exitCode = 1
  }
}

main()