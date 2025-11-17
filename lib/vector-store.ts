/**
 * Vector Store - OpenAI embeddings and semantic search
 * Handles embedding generation and cosine similarity calculations
 *
 * Security: Uses secure server-side API route for embeddings
 * Performance: Loads pre-generated contract embeddings from JSON
 */

import type { Contract, SearchResult } from '@/types'
import {
  getAllContracts,
  getContractEmbedding,
  saveContractEmbedding,
} from './contract-storage'

/**
 * Generate embedding for a text using secure API route
 * This replaces the client-side OpenAI call to protect the API key
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  try {
    console.log('[Vector Store] Computing embedding via API:', text.substring(0, 50) + '...')

    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate embedding')
    }

    const { embedding } = await response.json()
    console.log('[Vector Store] Embedding computed, dimensions:', embedding.length)

    return embedding
  } catch (error) {
    console.error('[Vector Store] Error computing embedding:', error)
    throw error
  }
}

/**
 * Compute embeddings for all contracts that don't have them yet
 * Returns number of embeddings generated
 */
export async function precomputeAllEmbeddings(
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  try {
    console.log('[Vector Store] Starting to precompute embeddings...')

    const contracts = await getAllContracts()
    const contractsNeedingEmbedding = contracts.filter(c => !c.embedding)

    if (contractsNeedingEmbedding.length === 0) {
      console.log('[Vector Store] All contracts already have embeddings')
      return 0
    }

    console.log(
      '[Vector Store]',
      contractsNeedingEmbedding.length,
      'contracts need embeddings'
    )

    let completed = 0

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10
    for (let i = 0; i < contractsNeedingEmbedding.length; i += BATCH_SIZE) {
      const batch = contractsNeedingEmbedding.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async contract => {
          // Combine title and description for better semantic matching
          const text = `${contract.title}\n\n${contract.description}`

          const embedding = await computeEmbedding(text)
          await saveContractEmbedding(contract.id, text, embedding)

          completed++
          if (onProgress) {
            onProgress(completed, contractsNeedingEmbedding.length)
          }
        })
      )

      // Small delay between batches
      if (i + BATCH_SIZE < contractsNeedingEmbedding.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('[Vector Store] Precomputed', completed, 'embeddings')
    return completed
  } catch (error) {
    console.error('[Vector Store] Error precomputing embeddings:', error)
    throw error
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)

  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Convert cosine similarity (-1 to 1) to match score (0-100)
 */
function similarityToScore(similarity: number): number {
  // Direct linear mapping: 0.0 → 0%, 1.0 → 100%
  // Previous mapping was too aggressive (< 0.5 → 0%)
  // For semantic search, 0.3-0.5 similarity is common and should be visible
  return Math.round(Math.max(0, Math.min(1, similarity)) * 100)
}

/**
 * Semantic search for contracts matching a query
 */
export async function semanticSearch(
  query: string,
  options: {
    limit?: number
    minScore?: number
    generateExplanations?: boolean
    explanationLimit?: number
  } = {}
): Promise<SearchResult[]> {
  try {
    const {
      limit = 1000, // Effectively unlimited for our dataset
      minScore = 0,
      generateExplanations = false,
      explanationLimit = 10,
    } = options

    console.log('[Vector Store] Searching for:', query)

    // Compute query embedding
    const queryEmbedding = await computeEmbedding(query)

    // Get all contracts
    const contracts = await getAllContracts()

    if (contracts.length === 0) {
      console.warn('[Vector Store] No contracts in storage')
      return []
    }

    // Calculate similarity scores
    const results: SearchResult[] = []

    for (const contract of contracts) {
      // Note: Inbox-specific hiding is handled at the UI layer via hiddenInInboxes array
      // Vector store returns all contracts for filtering upstream

      // Get or compute contract embedding
      let contractEmbedding = contract.embedding

      if (!contractEmbedding) {
        // Fallback: compute on-the-fly (shouldn't happen if precomputed)
        console.warn('[Vector Store] Contract missing embedding:', contract.id)
        const text = `${contract.title}\n\n${contract.description}`
        contractEmbedding = await computeEmbedding(text)
        await saveContractEmbedding(contract.id, text, contractEmbedding)
      }

      // Calculate similarity
      const similarity = cosineSimilarity(queryEmbedding, contractEmbedding)
      const matchScore = similarityToScore(similarity)

      // Log first 3 contracts to see actual similarity scores
      if (results.length < 3) {
        console.log(`[Vector Store] ${contract.title.substring(0, 40)}:`, {
          similarity: similarity.toFixed(4),
          score: matchScore,
          threshold: minScore,
          passes: matchScore >= minScore
        })
      }

      if (matchScore >= minScore) {
        results.push({
          contract,
          matchScore,
        })
      }
    }

    // Sort by match score (highest first)
    results.sort((a, b) => b.matchScore - a.matchScore)

    // Limit results
    const limited = results.slice(0, limit)

    // Generate explanations for top results if requested
    if (generateExplanations && limited.length > 0) {
      console.log('[Vector Store] Generating explanations for top', Math.min(explanationLimit, limited.length), 'results')

      const topResults = limited.slice(0, explanationLimit)

      // Generate explanations in parallel for top results
      await Promise.all(
        topResults.map(async result => {
          try {
            result.explanation = await generateMatchExplanation(query, result.contract)
          } catch (error) {
            console.error('[Vector Store] Error generating explanation for:', result.contract.id, error)
            result.explanation = 'This contract matches key aspects of your search criteria.'
          }
        })
      )
    }

    // Enhanced debug logging
    const scoreRange = results.length > 0 ? {
      min: Math.min(...results.map(r => r.matchScore)),
      max: Math.max(...results.map(r => r.matchScore)),
      avg: Math.round(results.reduce((sum, r) => sum + r.matchScore, 0) / results.length)
    } : null

    console.log('[Vector Store] Search results:', {
      totalContracts: contracts.filter(c => !c.isHidden).length,
      aboveThreshold: results.length,
      threshold: minScore,
      scoreRange,
      returned: limited.length
    })

    return limited
  } catch (error) {
    console.error('[Vector Store] Error in semantic search:', error)
    throw error
  }
}

/**
 * Generate an explanation for why a contract matches a query
 * Uses LLM to create natural language explanation
 */
export async function generateMatchExplanation(
  query: string,
  contract: Contract
): Promise<string> {
  try {
    const openai = getOpenAI()

    console.log('[Vector Store] Generating match explanation for:', contract.id)

    const prompt = `You are helping explain why a contract matches a user's search query.

User's Query: "${query}"

Contract:
Title: ${contract.title}
Authority: ${contract.authority}
Description: ${contract.description.substring(0, 500)}
Value: £${contract.value?.toLocaleString() || 'Not specified'}
Classification: ${contract.buyerClassification}

Write a brief 1-2 sentence explanation of why this contract is relevant to the user's query. Focus on the key matching aspects (topic alignment, buyer type, value range, etc.).`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap for simple tasks
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that explains contract relevance clearly and concisely.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    })

    const explanation = response.choices[0].message.content || 'Relevant to your search query.'

    console.log('[Vector Store] Generated explanation')
    return explanation
  } catch (error) {
    console.error('[Vector Store] Error generating explanation:', error)
    return 'This contract matches key aspects of your search criteria.'
  }
}

/**
 * Check if API key is configured
 */
/**
 * Check if API is available for embedding generation
 * Always returns true since we use server-side API route
 * Server will handle API key validation
 */
export function isAPIKeyConfigured(): boolean {
  // API key is now server-side only, so always return true
  // The /api/embed route will handle authentication and errors
  return true
}
