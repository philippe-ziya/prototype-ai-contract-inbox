/**
 * Prompt Refinement - Use AI to refine search prompts based on hide feedback
 */

import OpenAI from 'openai'
import type { PromptRefinement } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

/**
 * Refine an inbox prompt using GPT-4 based on user hide reasons
 *
 * Example:
 * - Original: "IT services for healthcare"
 * - Hide reasons: ["Too focused on software, I need hardware", "Looking for maintenance not development"]
 * - Refined: "IT hardware maintenance and support for healthcare, excluding software development"
 *
 * @param originalPrompt The current inbox search prompt
 * @param hideReasons Array of reasons why user hid high-scoring contracts
 * @returns Refined prompt that better matches user intent
 */
export async function refinePromptWithFeedback(
  originalPrompt: string,
  hideReasons: string[]
): Promise<string> {
  try {
    console.log('[Prompt Refinement] Refining prompt based on', hideReasons.length, 'hide reasons')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3, // Low temperature for consistency
      messages: [
        {
          role: 'system',
          content: `You are helping refine a search query for public sector contracts. The user has hidden several contracts that had high match scores, indicating the search is too broad or not capturing their true intent.

Your task: Generate a refined search query that:
1. Keeps the core intent of the original query
2. Excludes the types of contracts the user doesn't want (based on hide reasons)
3. Emphasizes what they DO want (inferred from patterns in hide reasons)
4. Is natural language, concise (1-2 sentences max)
5. Doesn't use technical jargon unless the original query did

Return ONLY the refined query, nothing else.`,
        },
        {
          role: 'user',
          content: `Original search query: "${originalPrompt}"

The user hid contracts with HIGH match scores for these reasons:
${hideReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Generate a refined search query that better matches what they're actually looking for.`,
        },
      ],
    })

    const refinedPrompt = response.choices[0].message.content?.trim() || originalPrompt

    console.log('[Prompt Refinement] Original:', originalPrompt)
    console.log('[Prompt Refinement] Refined:', refinedPrompt)

    return refinedPrompt
  } catch (error) {
    console.error('[Prompt Refinement] Error refining prompt:', error)
    // Return original prompt on error
    return originalPrompt
  }
}

/**
 * Check if prompt refinement should be offered to user
 *
 * Criteria:
 * - At least 3 high-score hides (>70% match)
 * - Hide reasons provided
 * - Not already refined recently (within last 24 hours)
 *
 * @param refinements Array of prompt refinement entries
 * @returns True if refinement should be offered
 */
export function shouldOfferPromptRefinement(refinements: PromptRefinement[]): boolean {
  if (refinements.length < 3) {
    return false
  }

  // Check if we have at least 3 high-score hides with reasons
  const highScoreHidesWithReasons = refinements.filter(
    r => r.matchScore > 70 && r.hideReason && r.hideReason.length > 5
  )

  if (highScoreHidesWithReasons.length < 3) {
    return false
  }

  // Check if we already refined recently (last 24 hours)
  const recentRefinements = refinements.filter(r => {
    if (!r.refinedPrompt) return false
    const timeSince = Date.now() - new Date(r.timestamp).getTime()
    return timeSince < 24 * 60 * 60 * 1000 // 24 hours
  })

  if (recentRefinements.length > 0) {
    return false // Already refined recently
  }

  return true
}

/**
 * Get unrefi
ned hide reasons for prompt update
 *
 * @param refinements Array of prompt refinement entries
 * @returns Array of hide reasons that haven't been used for refinement yet
 */
export function getUnrefinedHideReasons(refinements: PromptRefinement[]): string[] {
  return refinements
    .filter(r => !r.refinedPrompt && r.hideReason && r.matchScore > 70)
    .map(r => r.hideReason)
}
