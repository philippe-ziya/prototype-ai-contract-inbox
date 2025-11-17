import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client with server-side API key (not exposed to browser)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Simple in-memory rate limiting (resets on server restart)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 20 // requests per window
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(identifier)

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: Request) {
  try {
    // Basic rate limiting using IP or a session identifier
    const ip = request.headers.get('x-forwarded-for') || 'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse request body
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request. "text" field is required.' },
        { status: 400 }
      )
    }

    if (text.length > 8000) {
      return NextResponse.json(
        { error: 'Text too long. Maximum 8000 characters.' },
        { status: 400 }
      )
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server.' },
        { status: 500 }
      )
    }

    // Generate embedding using OpenAI
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    })

    const embedding = response.data[0].embedding

    return NextResponse.json({ embedding })
  } catch (error) {
    console.error('[API /embed] Error generating embedding:', error)

    return NextResponse.json(
      { error: 'Failed to generate embedding. Please try again.' },
      { status: 500 }
    )
  }
}
