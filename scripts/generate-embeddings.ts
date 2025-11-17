#!/usr/bin/env ts-node

/**
 * Build-time script to pre-generate embeddings for all contracts
 * Runs during Vercel deployment before the app is built
 * Saves embeddings to /public/data/contract-embeddings.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import OpenAI from 'openai'
import { parse } from 'csv-parse/sync'

// Types
interface Contract {
  id: string
  title: string
  description: string
}

interface ContractEmbedding {
  id: string
  text: string
  embedding: number[]
}

// Initialize OpenAI with server-side API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  })

  return response.data[0].embedding
}

async function main() {
  console.log('[Embedding Generation] Starting...')

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Embedding Generation] ERROR: OPENAI_API_KEY environment variable not set')
    console.error('Please set OPENAI_API_KEY in your environment or .env.local file')
    process.exit(1)
  }

  // Read CSV file
  const csvPath = join(process.cwd(), 'public', 'data', 'contracts.csv')
  console.log(`[Embedding Generation] Reading contracts from: ${csvPath}`)

  let csvContent: string
  try {
    csvContent = readFileSync(csvPath, 'utf-8')
  } catch (error) {
    console.error(`[Embedding Generation] ERROR: Failed to read CSV file: ${error}`)
    process.exit(1)
  }

  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`[Embedding Generation] Found ${records.length} contracts`)

  // Process contracts and generate embeddings
  const embeddings: ContractEmbedding[] = []
  const batchSize = 10
  let processed = 0

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length))

    // Generate embeddings for batch
    const batchPromises = batch.map(async (record: any) => {
      const contract: Contract = {
        id: record.Guid || record.guid || `contract-${i}`,
        title: record.Title || record.title || '',
        description: record.Description || record.description || '',
      }

      // Combine title and description for embedding
      const text = `${contract.title}\n\n${contract.description}`

      try {
        const embedding = await generateEmbedding(text)

        processed++
        console.log(`[Embedding Generation] Generated embedding ${processed}/${records.length}: ${contract.id.substring(0, 8)}...`)

        return {
          id: contract.id,
          text,
          embedding,
        }
      } catch (error) {
        console.error(`[Embedding Generation] ERROR generating embedding for ${contract.id}:`, error)
        throw error
      }
    })

    const batchResults = await Promise.all(batchPromises)
    embeddings.push(...batchResults)

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < records.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Save embeddings to JSON file
  const outputPath = join(process.cwd(), 'public', 'data', 'contract-embeddings.json')
  console.log(`[Embedding Generation] Saving embeddings to: ${outputPath}`)

  try {
    writeFileSync(
      outputPath,
      JSON.stringify(embeddings, null, 2),
      'utf-8'
    )
  } catch (error) {
    console.error(`[Embedding Generation] ERROR: Failed to write embeddings file: ${error}`)
    process.exit(1)
  }

  console.log(`[Embedding Generation] ✓ Successfully generated ${embeddings.length} embeddings`)
  console.log(`[Embedding Generation] ✓ File size: ${(JSON.stringify(embeddings).length / 1024 / 1024).toFixed(2)} MB`)
  console.log('[Embedding Generation] Complete!')
}

main().catch(error => {
  console.error('[Embedding Generation] Fatal error:', error)
  process.exit(1)
})
