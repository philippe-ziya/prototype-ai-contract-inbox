/**
 * Feedback Storage - IndexedDB layer for user feedback and learning
 * Tracks user actions to improve matching over time
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { UserFeedback, InboxLearningMetrics } from '@/types'
import { calculateDynamicThreshold } from './learning'

const DB_NAME = 'feedback-storage'
const DB_VERSION = 1

const FEEDBACK_STORE = 'feedback'

type FeedbackDB = IDBPDatabase<{
  feedback: {
    key: string
    value: UserFeedback
    indexes: { inboxId: string; contractId: string; action: string; timestamp: string }
  }
}>

/**
 * Initialize IndexedDB for feedback
 */
export async function initFeedbackDB(): Promise<FeedbackDB> {
  try {
    const db = await openDB<any>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log('[Feedback Storage] Upgrading database from version', oldVersion, 'to', DB_VERSION)

        if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
          const feedbackStore = db.createObjectStore(FEEDBACK_STORE, { keyPath: 'id' })

          // Create indexes for efficient queries
          feedbackStore.createIndex('inboxId', 'inboxId', { unique: false })
          feedbackStore.createIndex('contractId', 'contractId', { unique: false })
          feedbackStore.createIndex('action', 'action', { unique: false })
          feedbackStore.createIndex('timestamp', 'timestamp', { unique: false })

          console.log('[Feedback Storage] Created feedback store with indexes')
        }
      },
    })

    console.log('[Feedback Storage] Database initialized successfully')
    return db
  } catch (error) {
    console.error('[Feedback Storage] Error initializing database:', error)
    throw error
  }
}

/**
 * Record user feedback on a contract
 */
export async function recordFeedback(
  inboxId: string,
  contractId: string,
  action: UserFeedback['action'],
  matchScore: number,
  options: {
    hideReason?: string
    viewDuration?: number
  } = {}
): Promise<UserFeedback> {
  try {
    const feedback: UserFeedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      inboxId,
      contractId,
      action,
      matchScore,
      timestamp: new Date().toISOString(),
      ...options,
    }

    const db = await initFeedbackDB()
    await db.put(FEEDBACK_STORE, feedback)

    console.log('[Feedback Storage] Recorded feedback:', feedback.id, action, `score: ${matchScore}%`)

    return feedback
  } catch (error) {
    console.error('[Feedback Storage] Error recording feedback:', error)
    throw error
  }
}

/**
 * Get all feedback for an inbox
 */
export async function getFeedbackForInbox(inboxId: string): Promise<UserFeedback[]> {
  try {
    const db = await initFeedbackDB()
    const index = db.transaction(FEEDBACK_STORE).store.index('inboxId')
    const feedback = await index.getAll(inboxId)

    console.log('[Feedback Storage] Retrieved', feedback.length, 'feedback items for inbox:', inboxId)
    return feedback
  } catch (error) {
    console.error('[Feedback Storage] Error getting feedback:', error)
    return []
  }
}

/**
 * Get feedback for a specific contract
 */
export async function getFeedbackForContract(contractId: string): Promise<UserFeedback[]> {
  try {
    const db = await initFeedbackDB()
    const index = db.transaction(FEEDBACK_STORE).store.index('contractId')
    const feedback = await index.getAll(contractId)

    return feedback
  } catch (error) {
    console.error('[Feedback Storage] Error getting contract feedback:', error)
    return []
  }
}

/**
 * Analyze feedback patterns and calculate learning metrics
 */
export async function analyzeFeedbackPatterns(inboxId: string): Promise<InboxLearningMetrics> {
  try {
    const feedback = await getFeedbackForInbox(inboxId)

    if (feedback.length === 0) {
      // No feedback yet, return defaults
      return {
        inboxId,
        minRelevanceScore: 0,
        maxIrrelevanceScore: 100,
        dynamicMinScore: 30, // Start at lower baseline for better recall (changed from 50)
        thresholdAdjustments: {
          expandedCount: 0,
          narrowedCount: 0,
          lastAdjustment: new Date().toISOString(),
        },
        promptRefinements: [],
        pendingPromptUpdate: false,
        totalFeedback: 0,
        savedContracts: 0,
        hiddenContracts: 0,
        viewedContracts: 0,
        authorityBoosts: {},
        classificationBoosts: {},
        confidenceLevel: 0,
        lastUpdated: new Date().toISOString(),
      }
    }

    // Separate by action
    const saved = feedback.filter(f => f.action === 'saved')
    const hidden = feedback.filter(f => f.action === 'hidden')
    const viewed = feedback.filter(f => f.action === 'viewed')

    // Calculate thresholds
    const savedScores = saved.map(f => f.matchScore)
    const hiddenScores = hidden.map(f => f.matchScore)

    let minRelevanceScore = 0
    let maxIrrelevanceScore = 100

    if (savedScores.length > 0) {
      // Set min threshold 10% below lowest saved score
      const minSaved = Math.min(...savedScores)
      minRelevanceScore = Math.max(0, minSaved - 10)
    }

    if (hiddenScores.length > 0) {
      // Set max threshold 5% above highest hidden score
      const maxHidden = Math.max(...hiddenScores)
      maxIrrelevanceScore = Math.min(100, maxHidden + 5)
    }

    // Calculate confidence based on amount of feedback
    // More feedback = higher confidence in adjustments
    const confidenceLevel = Math.min(100, (feedback.length / 20) * 100)

    // Calculate dynamic threshold based on user behavior
    const currentThreshold = 50 // Start with moderate baseline
    const { threshold: dynamicMinScore, reason: thresholdReason } = calculateDynamicThreshold(
      feedback,
      currentThreshold
    )

    // Track threshold adjustments
    const thresholdAdjustments = {
      expandedCount: dynamicMinScore < currentThreshold ? 1 : 0,
      narrowedCount: dynamicMinScore > currentThreshold ? 1 : 0,
      lastAdjustment: new Date().toISOString(),
    }

    console.log('[Feedback Storage] Analyzed patterns:', {
      totalFeedback: feedback.length,
      saved: saved.length,
      hidden: hidden.length,
      minRelevanceScore,
      maxIrrelevanceScore,
      dynamicMinScore,
      thresholdReason,
      confidenceLevel: Math.round(confidenceLevel),
    })

    return {
      inboxId,
      minRelevanceScore: Math.round(minRelevanceScore),
      maxIrrelevanceScore: Math.round(maxIrrelevanceScore),
      dynamicMinScore,
      thresholdAdjustments,
      promptRefinements: [], // Managed separately in app logic
      pendingPromptUpdate: false,
      totalFeedback: feedback.length,
      savedContracts: saved.length,
      hiddenContracts: hidden.length,
      viewedContracts: viewed.length,
      authorityBoosts: {}, // TODO: Implement in Phase 4
      classificationBoosts: {}, // TODO: Implement in Phase 4
      confidenceLevel: Math.round(confidenceLevel),
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[Feedback Storage] Error analyzing patterns:', error)
    throw error
  }
}

/**
 * Clear all feedback for an inbox
 */
export async function clearInboxFeedback(inboxId: string): Promise<void> {
  try {
    const db = await initFeedbackDB()
    const feedback = await getFeedbackForInbox(inboxId)

    const tx = db.transaction(FEEDBACK_STORE, 'readwrite')
    await Promise.all([
      ...feedback.map(f => tx.store.delete(f.id)),
      tx.done,
    ])

    console.log('[Feedback Storage] Cleared', feedback.length, 'feedback items for inbox:', inboxId)
  } catch (error) {
    console.error('[Feedback Storage] Error clearing feedback:', error)
    throw error
  }
}

/**
 * Clear all feedback
 */
export async function clearAllFeedback(): Promise<void> {
  try {
    const db = await initFeedbackDB()
    await db.clear(FEEDBACK_STORE)
    console.log('[Feedback Storage] Cleared all feedback')
  } catch (error) {
    console.error('[Feedback Storage] Error clearing all feedback:', error)
    throw error
  }
}

/**
 * Get feedback statistics for display
 */
export async function getFeedbackStats(inboxId: string) {
  try {
    const feedback = await getFeedbackForInbox(inboxId)

    const saved = feedback.filter(f => f.action === 'saved')
    const hidden = feedback.filter(f => f.action === 'hidden')
    const viewed = feedback.filter(f => f.action === 'viewed')

    const avgSavedScore = saved.length > 0
      ? saved.reduce((sum, f) => sum + f.matchScore, 0) / saved.length
      : 0

    const avgHiddenScore = hidden.length > 0
      ? hidden.reduce((sum, f) => sum + f.matchScore, 0) / hidden.length
      : 0

    return {
      total: feedback.length,
      saved: saved.length,
      hidden: hidden.length,
      viewed: viewed.length,
      avgSavedScore: Math.round(avgSavedScore),
      avgHiddenScore: Math.round(avgHiddenScore),
    }
  } catch (error) {
    console.error('[Feedback Storage] Error getting stats:', error)
    return {
      total: 0,
      saved: 0,
      hidden: 0,
      viewed: 0,
      avgSavedScore: 0,
      avgHiddenScore: 0,
    }
  }
}
