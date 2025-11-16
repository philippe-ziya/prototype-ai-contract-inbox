/**
 * useInboxStorage - Hook for managing inboxes
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Inbox } from '@/types'
import {
  getAllInboxes,
  createInbox,
  deleteInbox,
  ensureDefaultInbox,
  updateUnreadCount,
} from '@/lib/inbox-storage'

export function useInboxStorage() {
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [activeInboxId, setActiveInboxId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load inboxes from IndexedDB
   */
  const loadInboxes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Ensure at least one inbox exists
      const defaultInbox = await ensureDefaultInbox()

      const stored = await getAllInboxes()
      setInboxes(stored)

      // Set active inbox if none selected
      if (!activeInboxId && stored.length > 0) {
        setActiveInboxId(stored[0].id)
      }

      console.log('[useInboxStorage] Loaded', stored.length, 'inboxes')
    } catch (err) {
      console.error('[useInboxStorage] Error loading inboxes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load inboxes')
    } finally {
      setLoading(false)
    }
  }, [activeInboxId])

  /**
   * Create a new inbox
   */
  const addInbox = useCallback(async (name: string, prompt: string) => {
    try {
      const inbox = await createInbox(name, prompt)

      setInboxes(prev => [...prev, inbox])
      setActiveInboxId(inbox.id)

      console.log('[useInboxStorage] Created inbox:', inbox.id, name)
      return inbox
    } catch (err) {
      console.error('[useInboxStorage] Error creating inbox:', err)
      setError(err instanceof Error ? err.message : 'Failed to create inbox')
      throw err
    }
  }, [])

  /**
   * Remove an inbox
   */
  const removeInbox = useCallback(async (id: string) => {
    try {
      await deleteInbox(id)

      setInboxes(prev => prev.filter(i => i.id !== id))

      // If active inbox was deleted, select first remaining
      if (activeInboxId === id) {
        const remaining = inboxes.filter(i => i.id !== id)
        setActiveInboxId(remaining.length > 0 ? remaining[0].id : null)
      }

      console.log('[useInboxStorage] Deleted inbox:', id)
    } catch (err) {
      console.error('[useInboxStorage] Error deleting inbox:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete inbox')
    }
  }, [activeInboxId, inboxes])

  /**
   * Update unread count for an inbox
   */
  const setUnreadCount = useCallback(async (id: string, count: number) => {
    try {
      await updateUnreadCount(id, count)

      setInboxes(prev =>
        prev.map(inbox => (inbox.id === id ? { ...inbox, unreadCount: count } : inbox))
      )
    } catch (err) {
      console.error('[useInboxStorage] Error updating unread count:', err)
    }
  }, [])

  /**
   * Get active inbox
   */
  const activeInbox = inboxes.find(i => i.id === activeInboxId) || null

  // Load inboxes on mount
  useEffect(() => {
    loadInboxes()
  }, [loadInboxes])

  return {
    inboxes,
    activeInbox,
    activeInboxId,
    loading,
    error,
    setActiveInboxId,
    addInbox,
    removeInbox,
    setUnreadCount,
    refreshInboxes: loadInboxes,
  }
}
