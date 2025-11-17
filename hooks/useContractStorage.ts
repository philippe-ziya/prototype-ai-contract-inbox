/**
 * useContractStorage - Hook for managing contracts
 * Pattern from response-writing-concept-v1/useFileStorage.ts
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Contract, ProcessingState } from '@/types'
import {
  getAllContracts,
  saveContracts,
  hasContracts,
  markContractAsSaved,
  markContractAsHidden,
  markContractAsRead,
  restoreContract,
} from '@/lib/contract-storage'
import { loadLocalContracts } from '@/lib/csv-loader'
import { recordFeedback } from '@/lib/feedback-storage'
import { updateInboxLearning } from '@/lib/learning'

export function useContractStorage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [embeddingProgress, setEmbeddingProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  /**
   * Load contracts from IndexedDB or CSV
   */
  const loadContracts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if we already have contracts in storage
      const exists = await hasContracts()

      if (exists) {
        console.log('[useContractStorage] Loading contracts from storage')
        const stored = await getAllContracts()
        setContracts(stored)
      } else {
        console.log('[useContractStorage] No contracts in storage, loading from CSV')
        setProcessingState('loading')

        // Load from CSV
        const loaded = await loadLocalContracts()
        console.log('[useContractStorage] Loaded', loaded.length, 'contracts from CSV')

        // Load pre-generated embeddings from JSON
        console.log('[useContractStorage] Loading pre-generated embeddings')
        setProcessingState('embedding')

        try {
          const response = await fetch('/data/contract-embeddings.json')

          if (!response.ok) {
            throw new Error('Failed to load pre-generated embeddings')
          }

          const embeddings: Array<{ id: string; embedding: number[] }> = await response.json()
          console.log('[useContractStorage] Loaded', embeddings.length, 'pre-generated embeddings')

          // Create embedding lookup map for fast access
          const embeddingMap = new Map(embeddings.map(e => [e.id, e.embedding]))

          // Merge embeddings with contracts
          const contractsWithEmbeddings = loaded.map((contract, index) => {
            const embedding = embeddingMap.get(contract.id)
            if (embedding) {
              setEmbeddingProgress({ current: index + 1, total: loaded.length })
            }
            return {
              ...contract,
              embedding: embedding || undefined,
            }
          })

          console.log('[useContractStorage] Merged embeddings with contracts')

          // Save to IndexedDB
          await saveContracts(contractsWithEmbeddings)
          setContracts(contractsWithEmbeddings)

          setProcessingState('complete')
        } catch (embeddingError) {
          console.warn('[useContractStorage] Failed to load pre-generated embeddings:', embeddingError)
          // Fallback: save contracts without embeddings
          await saveContracts(loaded)
          setContracts(loaded)
          setProcessingState('complete')
        }
      }
    } catch (err) {
      console.error('[useContractStorage] Error loading contracts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contracts')
      setProcessingState('error')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Save a contract
   */
  const saveContract = useCallback(async (
    id: string,
    context?: { inboxId?: string; matchScore?: number }
  ) => {
    try {
      await markContractAsSaved(id)

      // Update local state
      setContracts(prev =>
        prev.map(c => (c.id === id ? { ...c, isSaved: true } : c))
      )

      // Record feedback for learning
      if (context?.inboxId && context?.matchScore !== undefined) {
        await recordFeedback(context.inboxId, id, 'saved', context.matchScore)
        // Update learning metrics
        await updateInboxLearning(context.inboxId)
      }

      console.log('[useContractStorage] Contract saved:', id)
    } catch (err) {
      console.error('[useContractStorage] Error saving contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to save contract')
    }
  }, [])

  /**
   * Hide a contract (in a specific inbox if context provided)
   */
  const hideContract = useCallback(async (
    id: string,
    reason?: string,
    context?: { inboxId?: string; matchScore?: number }
  ) => {
    try {
      if (!context?.inboxId) {
        console.warn('[useContractStorage] Cannot hide contract without inbox context')
        return
      }

      await markContractAsHidden(id, context.inboxId, reason)

      // Update local state - add to hiddenInInboxes
      setContracts(prev =>
        prev.map(c => {
          if (c.id === id) {
            const hiddenInInboxes = [...(c.hiddenInInboxes || [])]
            if (!hiddenInInboxes.includes(context.inboxId!)) {
              hiddenInInboxes.push(context.inboxId!)
            }

            const hiddenMetadata = { ...(c.hiddenMetadata || {}) }
            hiddenMetadata[context.inboxId!] = {
              hiddenDate: new Date().toISOString(),
              hiddenReason: reason,
            }

            return { ...c, hiddenInInboxes, hiddenMetadata }
          }
          return c
        })
      )

      // Record feedback for learning
      if (context.matchScore !== undefined) {
        await recordFeedback(context.inboxId, id, 'hidden', context.matchScore, {
          hideReason: reason,
        })
        // Update learning metrics
        await updateInboxLearning(context.inboxId)
      }

      console.log('[useContractStorage] Contract hidden in inbox:', id, context.inboxId)
    } catch (err) {
      console.error('[useContractStorage] Error hiding contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to hide contract')
    }
  }, [])

  /**
   * Mark contract as read
   */
  const markAsRead = useCallback(async (
    id: string,
    context?: { inboxId?: string; matchScore?: number }
  ) => {
    try {
      await markContractAsRead(id)

      // Update local state
      setContracts(prev =>
        prev.map(c => (c.id === id ? { ...c, isUnread: false, isNew: false } : c))
      )

      // Record feedback for learning
      if (context?.inboxId && context?.matchScore !== undefined) {
        await recordFeedback(context.inboxId, id, 'viewed', context.matchScore)
      }

      console.log('[useContractStorage] Contract marked as read:', id)
    } catch (err) {
      console.error('[useContractStorage] Error marking contract as read:', err)
    }
  }, [])

  /**
   * Restore a hidden contract (unhide in a specific inbox)
   */
  const unhideContract = useCallback(async (id: string, inboxId: string) => {
    try {
      await restoreContract(id, inboxId)

      // Update local state - remove from hiddenInInboxes
      setContracts(prev =>
        prev.map(c => {
          if (c.id === id) {
            const hiddenInInboxes = (c.hiddenInInboxes || []).filter(
              (inbox) => inbox !== inboxId
            )

            const hiddenMetadata = { ...(c.hiddenMetadata || {}) }
            delete hiddenMetadata[inboxId]

            return {
              ...c,
              hiddenInInboxes,
              hiddenMetadata: Object.keys(hiddenMetadata).length > 0 ? hiddenMetadata : undefined,
            }
          }
          return c
        })
      )

      console.log('[useContractStorage] Contract restored in inbox:', id, inboxId)
    } catch (err) {
      console.error('[useContractStorage] Error restoring contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to restore contract')
    }
  }, [])

  /**
   * Refresh contracts from storage
   */
  const refreshContracts = useCallback(async () => {
    try {
      const stored = await getAllContracts()
      setContracts(stored)
    } catch (err) {
      console.error('[useContractStorage] Error refreshing contracts:', err)
    }
  }, [])

  // Load contracts on mount
  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  return {
    contracts,
    loading,
    processingState,
    embeddingProgress,
    error,
    saveContract,
    hideContract,
    markAsRead,
    unhideContract,
    refreshContracts,
  }
}
