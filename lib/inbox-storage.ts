/**
 * Inbox Storage - IndexedDB layer for inbox configurations
 * Pattern from response-writing-concept-v1/project-storage.ts
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { Inbox } from '@/types'

const DB_NAME = 'inbox-storage'
const DB_VERSION = 1

const INBOXES_STORE = 'inboxes'

type InboxDB = IDBPDatabase<{
  inboxes: {
    key: string
    value: Inbox
    indexes: { createdAt: string }
  }
}>

/**
 * Initialize IndexedDB for inboxes
 */
export async function initInboxDB(): Promise<InboxDB> {
  try {
    const db = await openDB<any>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log('[Inbox Storage] Upgrading database from version', oldVersion, 'to', DB_VERSION)

        if (!db.objectStoreNames.contains(INBOXES_STORE)) {
          const inboxStore = db.createObjectStore(INBOXES_STORE, { keyPath: 'id' })
          inboxStore.createIndex('createdAt', 'createdAt', { unique: false })

          console.log('[Inbox Storage] Created inboxes store')
        }
      },
    })

    console.log('[Inbox Storage] Database initialized successfully')
    return db
  } catch (error) {
    console.error('[Inbox Storage] Error initializing database:', error)
    throw error
  }
}

/**
 * Get all inboxes
 */
export async function getAllInboxes(): Promise<Inbox[]> {
  try {
    const db = await initInboxDB()
    const inboxes = await db.getAll(INBOXES_STORE)
    console.log('[Inbox Storage] Retrieved', inboxes.length, 'inboxes')
    return inboxes
  } catch (error) {
    console.error('[Inbox Storage] Error getting inboxes:', error)
    return []
  }
}

/**
 * Get a single inbox by ID
 */
export async function getInboxById(id: string): Promise<Inbox | undefined> {
  try {
    const db = await initInboxDB()
    const inbox = await db.get(INBOXES_STORE, id)
    return inbox
  } catch (error) {
    console.error('[Inbox Storage] Error getting inbox:', error)
    return undefined
  }
}

/**
 * Create a new inbox
 */
export async function createInbox(
  name: string,
  prompt: string,
  isAllContractsInbox: boolean = false
): Promise<Inbox> {
  try {
    const inbox: Inbox = {
      id: `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      prompt,
      isAllContractsInbox,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unreadCount: 0,
    }

    const db = await initInboxDB()
    await db.put(INBOXES_STORE, inbox)

    console.log('[Inbox Storage] Created inbox:', inbox.id, inbox.name)
    return inbox
  } catch (error) {
    console.error('[Inbox Storage] Error creating inbox:', error)
    throw error
  }
}

/**
 * Update an inbox
 */
export async function updateInbox(
  id: string,
  updates: Partial<Inbox>
): Promise<Inbox | undefined> {
  try {
    const db = await initInboxDB()
    const inbox = await db.get(INBOXES_STORE, id)

    if (!inbox) {
      console.warn('[Inbox Storage] Inbox not found for update:', id)
      return undefined
    }

    const updated = {
      ...inbox,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    await db.put(INBOXES_STORE, updated)

    console.log('[Inbox Storage] Updated inbox:', id, updates)
    return updated
  } catch (error) {
    console.error('[Inbox Storage] Error updating inbox:', error)
    return undefined
  }
}

/**
 * Delete an inbox
 */
export async function deleteInbox(id: string): Promise<void> {
  try {
    const db = await initInboxDB()
    await db.delete(INBOXES_STORE, id)

    console.log('[Inbox Storage] Deleted inbox:', id)
  } catch (error) {
    console.error('[Inbox Storage] Error deleting inbox:', error)
    throw error
  }
}

/**
 * Save inbox embedding
 */
export async function saveInboxEmbedding(
  inboxId: string,
  embedding: number[]
): Promise<void> {
  await updateInbox(inboxId, { embedding })
}

/**
 * Update unread count for an inbox
 */
export async function updateUnreadCount(id: string, count: number): Promise<void> {
  await updateInbox(id, { unreadCount: count })
}

/**
 * Clear all inboxes
 */
export async function clearAllInboxes(): Promise<void> {
  try {
    const db = await initInboxDB()
    await db.clear(INBOXES_STORE)
    console.log('[Inbox Storage] Cleared all inboxes')
  } catch (error) {
    console.error('[Inbox Storage] Error clearing inboxes:', error)
    throw error
  }
}

/**
 * Check if any inboxes exist
 */
export async function hasInboxes(): Promise<boolean> {
  try {
    const db = await initInboxDB()
    const count = await db.count(INBOXES_STORE)
    return count > 0
  } catch (error) {
    console.error('[Inbox Storage] Error checking inboxes:', error)
    return false
  }
}

/**
 * Initialize with default inbox if none exist
 */
export async function ensureDefaultInbox(): Promise<Inbox> {
  const exists = await hasInboxes()

  if (!exists) {
    console.log('[Inbox Storage] Creating default "All Contracts" inbox (special)')
    return createInbox('All Contracts', 'Show me all relevant public sector contracts', true)
  }

  const inboxes = await getAllInboxes()
  return inboxes[0]
}
