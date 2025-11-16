/**
 * useSemanticSearch - Hook for performing semantic search
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Contract, SearchResult, Inbox } from '@/types'
import { semanticSearch, isAPIKeyConfigured } from '@/lib/vector-store'
import { applyLearning } from '@/lib/learning'

export function useSemanticSearch(
  query: string | null,
  inbox: Inbox | null,
  enabled: boolean = true
) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Perform semantic search
   */
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery || !enabled) {
      setResults([])
      return
    }

    if (!isAPIKeyConfigured()) {
      setError('OpenAI API key not configured')
      return
    }

    try {
      setSearching(true)
      setError(null)

      console.log('[useSemanticSearch] Searching for:', searchQuery)

      // Use dynamic threshold if available, otherwise default to 30 (lowered from 50 for better recall)
      const dynamicThreshold = inbox?.learningMetrics?.dynamicMinScore ?? 30

      if (dynamicThreshold !== 30) {
        console.log('[useSemanticSearch] Using dynamic threshold:', dynamicThreshold)
      }

      const matches = await semanticSearch(searchQuery, {
        limit: 1000, // Effectively unlimited for our dataset (623 contracts)
        minScore: dynamicThreshold, // Adaptive threshold based on user behavior (30-70)
        generateExplanations: true, // Generate explanations for top matches
        explanationLimit: 10, // Only top 10 to save API costs
      })

      // Apply learning if inbox has metrics
      const improved = applyLearning(matches, inbox?.learningMetrics)

      setResults(improved)

      console.log('[useSemanticSearch] Found', matches.length, 'matches, applied learning:', improved.length, 'results')
    } catch (err) {
      console.error('[useSemanticSearch] Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [enabled, inbox])

  /**
   * Search when query changes
   */
  useEffect(() => {
    if (query && enabled) {
      search(query)
    } else {
      setResults([])
    }
  }, [query, enabled, search])

  /**
   * Get contracts from results (for compatibility with existing UI)
   */
  const contracts = results.map(r => ({
    ...r.contract,
    matchScore: r.matchScore,
    explanation: r.explanation,
  }))

  return {
    results,
    contracts,
    searching,
    error,
    search,
  }
}
