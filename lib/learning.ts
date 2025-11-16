/**
 * Learning utilities - Apply user feedback to improve matching
 */

import type { Contract, SearchResult, InboxLearningMetrics } from '@/types'
import { analyzeFeedbackPatterns } from './feedback-storage'
import { updateInbox } from './inbox-storage'

/**
 * Update inbox learning metrics based on accumulated feedback
 */
export async function updateInboxLearning(inboxId: string): Promise<InboxLearningMetrics> {
  try {
    console.log('[Learning] Updating learning metrics for inbox:', inboxId)

    // Analyze feedback patterns
    const metrics = await analyzeFeedbackPatterns(inboxId)

    // Save metrics to inbox
    await updateInbox(inboxId, {
      learningMetrics: metrics,
    })

    console.log('[Learning] Updated metrics:', {
      minRelevance: metrics.minRelevanceScore,
      maxIrrelevance: metrics.maxIrrelevanceScore,
      confidence: metrics.confidenceLevel,
      feedback: metrics.totalFeedback,
    })

    return metrics
  } catch (error) {
    console.error('[Learning] Error updating learning:', error)
    throw error
  }
}

/**
 * Apply learned thresholds to search results
 * Filters out contracts outside the learned relevance range
 */
export function applyLearnedThresholds(
  results: SearchResult[],
  metrics: InboxLearningMetrics | undefined
): SearchResult[] {
  if (!metrics || metrics.totalFeedback < 5) {
    // Not enough feedback to apply learning
    return results
  }

  const { minRelevanceScore, maxIrrelevanceScore, confidenceLevel } = metrics

  // Only apply if we have reasonable confidence
  if (confidenceLevel < 30) {
    return results
  }

  console.log('[Learning] Applying thresholds:', {
    min: minRelevanceScore,
    max: maxIrrelevanceScore,
    confidence: confidenceLevel,
  })

  // Filter results based on learned thresholds
  const filtered = results.filter(result => {
    const score = result.matchScore

    // Below minimum relevance threshold
    if (score < minRelevanceScore) {
      console.log('[Learning] Filtering out low score:', score, result.contract.title.substring(0, 50))
      return false
    }

    // Above maximum irrelevance threshold (high scores that user consistently hides)
    if (score > maxIrrelevanceScore) {
      console.log('[Learning] Filtering out falsely high score:', score, result.contract.title.substring(0, 50))
      return false
    }

    return true
  })

  console.log(
    '[Learning] Filtered',
    results.length - filtered.length,
    'contracts based on learned thresholds'
  )

  return filtered
}

/**
 * Apply learned boosts to contract scores
 * Adjusts scores based on authority and classification patterns
 */
export function applyLearnedBoosts(
  results: SearchResult[],
  metrics: InboxLearningMetrics | undefined
): SearchResult[] {
  if (!metrics || metrics.totalFeedback < 10) {
    // Not enough feedback for boost learning
    return results
  }

  const { authorityBoosts, classificationBoosts, confidenceLevel } = metrics

  // Only apply if we have good confidence
  if (confidenceLevel < 50) {
    return results
  }

  // Apply boosts
  return results.map(result => {
    let adjustedScore = result.matchScore

    // Authority boost
    const authorityBoost = authorityBoosts[result.contract.authority] || 0
    if (authorityBoost !== 0) {
      adjustedScore += authorityBoost
      console.log(
        '[Learning] Authority boost:',
        result.contract.authority,
        authorityBoost,
        `(${result.matchScore}% → ${adjustedScore}%)`
      )
    }

    // Classification boost
    const classBoost = classificationBoosts[result.contract.buyerClassification] || 0
    if (classBoost !== 0) {
      adjustedScore += classBoost
      console.log(
        '[Learning] Classification boost:',
        result.contract.buyerClassification,
        classBoost,
        `(${result.matchScore}% → ${adjustedScore}%)`
      )
    }

    // Clamp to 0-100
    adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)))

    return {
      ...result,
      matchScore: adjustedScore,
    }
  })
}

/**
 * Apply all learning improvements to search results
 */
export function applyLearning(
  results: SearchResult[],
  metrics: InboxLearningMetrics | undefined
): SearchResult[] {
  if (!metrics) {
    return results
  }

  console.log('[Learning] Applying learning with', metrics.totalFeedback, 'feedback events')

  // Apply boosts first (adjust scores)
  let improved = applyLearnedBoosts(results, metrics)

  // Then filter with thresholds (remove irrelevant)
  improved = applyLearnedThresholds(improved, metrics)

  // Re-sort by adjusted scores
  improved.sort((a, b) => b.matchScore - a.matchScore)

  return improved
}

/**
 * Check if inbox has enough feedback to benefit from learning
 */
export function shouldApplyLearning(metrics: InboxLearningMetrics | undefined): boolean {
  if (!metrics) return false
  return metrics.totalFeedback >= 5 && metrics.confidenceLevel >= 30
}

/**
 * Calculate dynamic minimum score threshold based on user behavior
 *
 * - If user saves low-scored contracts: lower threshold (expand search)
 * - If user hides many contracts: raise threshold (narrow search)
 *
 * @param feedbackEvents All feedback for this inbox
 * @param currentThreshold Current dynamic threshold (default 50)
 * @returns New threshold value (30-70 range)
 */
export function calculateDynamicThreshold(
  feedbackEvents: import('@/types').UserFeedback[],
  currentThreshold: number = 50
): { threshold: number; reason?: string } {
  if (feedbackEvents.length < 10) {
    // Not enough data to adjust threshold yet
    return { threshold: currentThreshold }
  }

  // Analyze recent 10 saves and 10 hides
  const recentFeedback = feedbackEvents.slice(-20)
  const recentSaves = recentFeedback.filter(f => f.action === 'saved')
  const recentHides = recentFeedback.filter(f => f.action === 'hidden')

  let newThreshold = currentThreshold
  let reason: string | undefined

  // EXPAND: If user is saving low-scored contracts (within 10% of threshold)
  const lowScoreSaves = recentSaves.filter(
    f => f.matchScore < currentThreshold + 10 && f.matchScore > 0
  )

  if (lowScoreSaves.length >= 3 && recentSaves.length >= 5) {
    // User is finding value in borderline matches - lower threshold
    newThreshold = Math.max(30, currentThreshold - 10)
    reason = `Expanded: You saved ${lowScoreSaves.length} contracts near threshold`
  }

  // NARROW: If user is hiding many contracts (>60% hide rate)
  const totalActions = recentSaves.length + recentHides.length
  const hideRate = recentHides.length / totalActions

  if (hideRate > 0.6 && totalActions >= 10) {
    // User is hiding most results - raise threshold
    newThreshold = Math.min(70, currentThreshold + 10)
    reason = `Narrowed: You hid ${Math.round(hideRate * 100)}% of results`
  }

  // Clamp to reasonable range
  newThreshold = Math.max(30, Math.min(70, newThreshold))

  return { threshold: newThreshold, reason }
}

/**
 * Get learning status message for UI
 */
export function getLearningStatus(metrics: InboxLearningMetrics | undefined): string {
  if (!metrics || metrics.totalFeedback === 0) {
    return 'No learning data yet. Save or hide contracts to improve matching.'
  }

  if (metrics.totalFeedback < 5) {
    return `Learning... (${metrics.totalFeedback}/5 feedback events needed)`
  }

  if (metrics.confidenceLevel < 30) {
    return `Learning in progress (${metrics.confidenceLevel}% confidence)`
  }

  // Show dynamic threshold info if adjusted
  const thresholdInfo = metrics.dynamicMinScore !== 50
    ? ` • Threshold: ${metrics.dynamicMinScore}%`
    : ''

  return `Active learning (${metrics.totalFeedback} events, ${metrics.confidenceLevel}% confidence${thresholdInfo})`
}
