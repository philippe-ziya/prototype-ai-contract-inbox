/**
 * Contract Storage - IndexedDB layer for contracts and embeddings
 * Pattern from response-writing-concept-v1/file-storage.ts
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { Contract, EmbeddingCache } from '@/types'

const DB_NAME = 'contract-storage'
const DB_VERSION = 1

const CONTRACTS_STORE = 'contracts'
const EMBEDDINGS_STORE = 'embeddings'

type ContractDB = IDBPDatabase<{
  contracts: {
    key: string
    value: Contract
    indexes: { authority: string; buyerClassification: string; closeDate: string }
  }
  embeddings: {
    key: string
    value: EmbeddingCache
  }
}>

/**
 * Initialize IndexedDB for contracts
 */
export async function initContractDB(): Promise<ContractDB> {
  try {
    const db = await openDB<any>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log('[Contract Storage] Upgrading database from version', oldVersion, 'to', DB_VERSION)

        // Create contracts store
        if (!db.objectStoreNames.contains(CONTRACTS_STORE)) {
          const contractStore = db.createObjectStore(CONTRACTS_STORE, { keyPath: 'id' })

          // Create indexes for efficient queries
          contractStore.createIndex('authority', 'authority', { unique: false })
          contractStore.createIndex('buyerClassification', 'buyerClassification', { unique: false })
          contractStore.createIndex('closeDate', 'closeDate', { unique: false })

          console.log('[Contract Storage] Created contracts store with indexes')
        }

        // Create embeddings cache store
        if (!db.objectStoreNames.contains(EMBEDDINGS_STORE)) {
          db.createObjectStore(EMBEDDINGS_STORE, { keyPath: 'id' })
          console.log('[Contract Storage] Created embeddings store')
        }
      },
    })

    console.log('[Contract Storage] Database initialized successfully')
    return db
  } catch (error) {
    console.error('[Contract Storage] Error initializing database:', error)
    throw error
  }
}

/**
 * Migrate contract from old structure to new structure
 * Converts isHidden boolean to hiddenInInboxes array
 */
function migrateContract(contract: any): Contract {
  // Check if migration is needed
  if ('isHidden' in contract && !('hiddenInInboxes' in contract)) {
    console.log('[Contract Storage] Migrating contract:', contract.id)

    const migrated = { ...contract }

    // Convert isHidden boolean to hiddenInInboxes array
    // Since we don't know which inbox it was hidden in, we'll clear it
    delete migrated.isHidden
    delete migrated.hiddenBy
    delete migrated.hiddenDate
    delete migrated.hiddenReason

    migrated.hiddenInInboxes = []
    migrated.hiddenMetadata = undefined

    return migrated as Contract
  }

  // Ensure hiddenInInboxes exists
  if (!contract.hiddenInInboxes) {
    contract.hiddenInInboxes = []
  }

  return contract as Contract
}

/**
 * Get all contracts from storage
 */
export async function getAllContracts(): Promise<Contract[]> {
  try {
    const db = await initContractDB()
    const rawContracts = await db.getAll(CONTRACTS_STORE)

    // Migrate any old contracts
    const contracts = rawContracts.map(migrateContract)

    // Check if any contracts were migrated and save them back
    const migratedContracts = contracts.filter((c, i) =>
      'isHidden' in rawContracts[i] && !('hiddenInInboxes' in rawContracts[i])
    )

    if (migratedContracts.length > 0) {
      console.log('[Contract Storage] Migrating', migratedContracts.length, 'contracts to new structure')
      await saveContracts(contracts)
    }

    console.log('[Contract Storage] Retrieved', contracts.length, 'contracts')
    return contracts
  } catch (error) {
    console.error('[Contract Storage] Error getting contracts:', error)
    return []
  }
}

/**
 * Get a single contract by ID
 */
export async function getContractById(id: string): Promise<Contract | undefined> {
  try {
    const db = await initContractDB()
    const contract = await db.get(CONTRACTS_STORE, id)
    return contract
  } catch (error) {
    console.error('[Contract Storage] Error getting contract:', error)
    return undefined
  }
}

/**
 * Save or update a contract
 */
export async function saveContract(contract: Contract): Promise<void> {
  try {
    const db = await initContractDB()
    await db.put(CONTRACTS_STORE, contract)
    console.log('[Contract Storage] Saved contract:', contract.id)
  } catch (error) {
    console.error('[Contract Storage] Error saving contract:', error)
    throw error
  }
}

/**
 * Save multiple contracts (bulk operation)
 */
export async function saveContracts(contracts: Contract[]): Promise<void> {
  try {
    const db = await initContractDB()
    const tx = db.transaction(CONTRACTS_STORE, 'readwrite')

    const promises = contracts.map(contract => tx.store.put(contract))
    await Promise.all([...promises, tx.done])

    console.log('[Contract Storage] Saved', contracts.length, 'contracts')
  } catch (error) {
    console.error('[Contract Storage] Error saving contracts:', error)
    throw error
  }
}

/**
 * Update contract fields (partial update)
 */
export async function updateContract(
  id: string,
  updates: Partial<Contract>
): Promise<Contract | undefined> {
  try {
    const db = await initContractDB()
    const contract = await db.get(CONTRACTS_STORE, id)

    if (!contract) {
      console.warn('[Contract Storage] Contract not found for update:', id)
      return undefined
    }

    const updated = { ...contract, ...updates }
    await db.put(CONTRACTS_STORE, updated)

    console.log('[Contract Storage] Updated contract:', id, updates)
    return updated
  } catch (error) {
    console.error('[Contract Storage] Error updating contract:', error)
    return undefined
  }
}

/**
 * Delete a contract
 */
export async function deleteContract(id: string): Promise<void> {
  try {
    const db = await initContractDB()
    await db.delete(CONTRACTS_STORE, id)

    // Also delete associated embedding
    await db.delete(EMBEDDINGS_STORE, id)

    console.log('[Contract Storage] Deleted contract:', id)
  } catch (error) {
    console.error('[Contract Storage] Error deleting contract:', error)
    throw error
  }
}

/**
 * Mark contract as saved
 */
export async function markContractAsSaved(id: string): Promise<void> {
  await updateContract(id, { isSaved: true })
}

/**
 * Mark contract as hidden in a specific inbox
 */
export async function markContractAsHidden(
  id: string,
  inboxId: string,
  reason?: string
): Promise<void> {
  const contract = await getContractById(id)
  if (!contract) {
    console.warn('[Contract Storage] Contract not found for hiding:', id)
    return
  }

  // Add to hidden inboxes if not already there
  const hiddenInInboxes = contract.hiddenInInboxes || []
  if (!hiddenInInboxes.includes(inboxId)) {
    hiddenInInboxes.push(inboxId)
  }

  // Store metadata for this inbox
  const hiddenMetadata = contract.hiddenMetadata || {}
  hiddenMetadata[inboxId] = {
    hiddenDate: new Date().toISOString(),
    hiddenReason: reason,
  }

  await updateContract(id, {
    hiddenInInboxes,
    hiddenMetadata,
  })

  console.log('[Contract Storage] Hidden contract in inbox:', id, inboxId)
}

/**
 * Mark contract as read
 */
export async function markContractAsRead(id: string): Promise<void> {
  await updateContract(id, { isUnread: false, isNew: false })
}

/**
 * Restore contract in a specific inbox (unhide)
 */
export async function restoreContract(id: string, inboxId: string): Promise<void> {
  const contract = await getContractById(id)
  if (!contract) {
    console.warn('[Contract Storage] Contract not found for restoration:', id)
    return
  }

  // Remove from hidden inboxes
  const hiddenInInboxes = (contract.hiddenInInboxes || []).filter(
    (inbox) => inbox !== inboxId
  )

  // Remove metadata for this inbox
  const hiddenMetadata = { ...(contract.hiddenMetadata || {}) }
  delete hiddenMetadata[inboxId]

  await updateContract(id, {
    hiddenInInboxes,
    hiddenMetadata: Object.keys(hiddenMetadata).length > 0 ? hiddenMetadata : undefined,
  })

  console.log('[Contract Storage] Restored contract in inbox:', id, inboxId)
}

// ========== Embedding Storage ==========

/**
 * Save contract embedding to cache
 */
export async function saveContractEmbedding(
  contractId: string,
  text: string,
  embedding: number[]
): Promise<void> {
  try {
    const db = await initContractDB()

    const cache: EmbeddingCache = {
      id: contractId,
      text,
      embedding,
      createdAt: new Date().toISOString(),
    }

    await db.put(EMBEDDINGS_STORE, cache)
    console.log('[Contract Storage] Saved embedding for contract:', contractId)

    // Also update the contract with the embedding
    await updateContract(contractId, { embedding })
  } catch (error) {
    console.error('[Contract Storage] Error saving embedding:', error)
    throw error
  }
}

/**
 * Get cached embedding for a contract
 */
export async function getContractEmbedding(
  contractId: string
): Promise<number[] | undefined> {
  try {
    const db = await initContractDB()
    const cache = await db.get(EMBEDDINGS_STORE, contractId)
    return cache?.embedding
  } catch (error) {
    console.error('[Contract Storage] Error getting embedding:', error)
    return undefined
  }
}

/**
 * Get all cached embeddings
 */
export async function getAllEmbeddings(): Promise<Map<string, number[]>> {
  try {
    const db = await initContractDB()
    const caches = await db.getAll(EMBEDDINGS_STORE)

    const map = new Map<string, number[]>()
    caches.forEach(cache => {
      map.set(cache.id, cache.embedding)
    })

    console.log('[Contract Storage] Retrieved', map.size, 'cached embeddings')
    return map
  } catch (error) {
    console.error('[Contract Storage] Error getting embeddings:', error)
    return new Map()
  }
}

// ========== Bulk Operations ==========

/**
 * Clear all contracts and embeddings
 */
export async function clearAllContracts(): Promise<void> {
  try {
    const db = await initContractDB()
    await db.clear(CONTRACTS_STORE)
    await db.clear(EMBEDDINGS_STORE)
    console.log('[Contract Storage] Cleared all contracts and embeddings')
  } catch (error) {
    console.error('[Contract Storage] Error clearing contracts:', error)
    throw error
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  try {
    const db = await initContractDB()
    const contractCount = await db.count(CONTRACTS_STORE)
    const embeddingCount = await db.count(EMBEDDINGS_STORE)

    const contracts = await getAllContracts()
    const savedCount = contracts.filter(c => c.isSaved).length
    const hiddenCount = contracts.filter(c => c.hiddenInInboxes && c.hiddenInInboxes.length > 0).length
    const unreadCount = contracts.filter(c => c.isUnread).length

    return {
      contractCount,
      embeddingCount,
      savedCount,
      hiddenCount,
      unreadCount,
    }
  } catch (error) {
    console.error('[Contract Storage] Error getting stats:', error)
    return {
      contractCount: 0,
      embeddingCount: 0,
      savedCount: 0,
      hiddenCount: 0,
      unreadCount: 0,
    }
  }
}

/**
 * Check if contracts have been loaded into storage
 */
export async function hasContracts(): Promise<boolean> {
  try {
    const db = await initContractDB()
    const count = await db.count(CONTRACTS_STORE)
    return count > 0
  } catch (error) {
    console.error('[Contract Storage] Error checking contracts:', error)
    return false
  }
}
