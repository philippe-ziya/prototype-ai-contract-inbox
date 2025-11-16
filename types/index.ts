/**
 * Core type definitions for the Contract Inbox application
 * Following the pattern from response-writing-concept-v1
 */

/**
 * Contract - Simplified from CSV with 30 columns to essential fields
 */
export interface Contract {
  id: string
  title: string
  description: string
  authority: string // Buyer name from CSV
  value: number | null
  closeDate: string // ISO date string
  publishDate: string // ISO date string
  url: string
  buyerClassification: string // e.g., "Central", "Local", "Education"

  // AI/Semantic search
  embedding?: number[] // Vector representation for semantic search

  // UI State (managed per user in IndexedDB)
  isNew: boolean
  isSaved: boolean // Global across all inboxes
  isUnread: boolean

  // Per-inbox hiding (contract can be hidden in one inbox but visible in another)
  hiddenInInboxes: string[] // Array of inbox IDs where this contract is hidden
  hiddenMetadata?: Record<string, { // Metadata per inbox
    hiddenBy?: string
    hiddenDate: string
    hiddenReason?: string
  }>

  // Display fields (computed/dynamic)
  matchScore?: number // 0-100, from semantic search or default 100
  snippet?: string // Short description for cards (first 120 chars)
  deadline?: string // Human-readable deadline (e.g., "7 days", "3 weeks")
  explanation?: string // AI-generated match explanation
}

/**
 * Raw contract data from CSV (before processing)
 */
export interface RawContractCSV {
  Guid: string
  Title: string
  Description: string
  'Buyer name': string
  Value: string
  'Close date': string
  'Publish date': string
  URL: string
  'Buyer Classification': string
  Currency: string
  Country: string
  // ... other CSV columns available but not used
}

/**
 * Inbox - User's saved search configuration
 */
export interface Inbox {
  id: string
  name: string
  prompt: string // Natural language query (e.g., "IT services for NHS trusts")
  embedding?: number[] // Prompt embedding for semantic matching
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
  unreadCount: number

  // Special inbox flag - bypasses semantic search to show all contracts
  isAllContractsInbox?: boolean

  // Optional filters (not implemented yet, but structure ready)
  filters?: {
    valueMin?: number
    valueMax?: number
    buyerTypes?: string[]
    locations?: string[]
  }

  // Learning metrics (adaptive matching based on user feedback)
  learningMetrics?: InboxLearningMetrics
}

/**
 * Search result with match score
 */
export interface SearchResult {
  contract: Contract
  matchScore: number // 0-100, based on cosine similarity
  explanation?: string // AI-generated "why this matches" text
}

/**
 * Embedding cache entry (stored in IndexedDB)
 */
export interface EmbeddingCache {
  id: string // Contract ID or Inbox ID
  text: string // The text that was embedded (for cache invalidation)
  embedding: number[]
  createdAt: string
}

/**
 * Processing state for async operations (pattern from response-writing-concept-v1)
 */
export type ProcessingState =
  | 'idle'
  | 'loading'
  | 'embedding' // Computing embeddings
  | 'searching' // Performing semantic search
  | 'complete'
  | 'error'

/**
 * Error details for failed operations
 */
export interface ProcessingError {
  message: string
  code?: string
  timestamp: string
}

/**
 * User feedback on contract relevance
 * Used to learn and improve matching over time
 */
export interface UserFeedback {
  id: string
  inboxId: string
  contractId: string
  action: 'saved' | 'hidden' | 'viewed' | 'ignored'
  matchScore: number // Score at time of action
  timestamp: string
  hideReason?: string // User-provided reason for hiding
  viewDuration?: number // Seconds spent viewing (for engagement tracking)
}

/**
 * Prompt refinement entry
 */
export interface PromptRefinement {
  originalPrompt: string
  refinedPrompt?: string
  hideReason: string
  matchScore: number
  timestamp: string
}

/**
 * Learning metrics for an inbox
 * Tracks user preferences and adjusts matching accordingly
 */
export interface InboxLearningMetrics {
  inboxId: string

  // Adaptive thresholds (learned from user feedback)
  minRelevanceScore: number // Don't show contracts below this (default 0)
  maxIrrelevanceScore: number // Even high scores can be irrelevant (default 100)

  // Dynamic minimum score threshold (starts at 50, adjusts based on behavior)
  dynamicMinScore: number // Default 50, range 30-70
  thresholdAdjustments: {
    expandedCount: number // Times threshold was lowered
    narrowedCount: number // Times threshold was raised
    lastAdjustment: string // timestamp
  }

  // Prompt refinement from high-score hides
  promptRefinements: PromptRefinement[]
  pendingPromptUpdate: boolean // True when 3+ high-score hides accumulated

  // Feedback statistics
  totalFeedback: number
  savedContracts: number
  hiddenContracts: number
  viewedContracts: number

  // Score adjustments based on patterns
  authorityBoosts: Record<string, number> // e.g., {"NHS Surrey": +10}
  classificationBoosts: Record<string, number> // e.g., {"Central": -5}

  // Confidence level (0-100)
  // Higher confidence means more aggressive adjustments
  confidenceLevel: number

  lastUpdated: string
}
