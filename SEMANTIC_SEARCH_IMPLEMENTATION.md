# Semantic Search Implementation Guide

## Overview

This document describes the AI-powered semantic search architecture for the Public Sector Contract Inbox platform. The system enables users to find relevant public sector procurement opportunities using natural language queries, combining semantic understanding with traditional keyword matching for optimal results.

**Core Capability**: Users type queries like *"Construction projects over £100k in the South East"* and the system returns ranked, relevant contracts with match explanations.

## Architecture Components

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE-TIME SETUP PHASE                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  UK Contracts Data  →  Chunk  →  Embed  →  Vector Database  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SEARCH REQUEST PHASE                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Query  →  Embed Query  →  Hybrid Search  →  Rerank    │
│                                         ↓                     │
│                                    Apply Filters              │
│                                         ↓                     │
│                                  Score & Explain              │
│                                         ↓                     │
│                                   Return Results              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 1. Data Preparation Pipeline

### 1.1 Contract Ingestion

**Source**: UK Contracts Finder API (or similar procurement data source)

**Contract Data Structure**:
```typescript
interface Contract {
  id: string;
  title: string;
  description: string;           // Main text for semantic search
  authority_name: string;
  value: number | null;
  deadline: Date;
  published_date: Date;
  location: string;               // Geographic area
  cpv_codes: string[];            // Common Procurement Vocabulary codes
  buyer_type: string;             // NHS, Local Council, etc.
  source_url: string;
}
```

### 1.2 Chunking Strategy

**Why chunk?** 
- Embedding models have token limits (typically 8,192 tokens)
- Smaller chunks provide more precise matching
- Allows multiple relevant passages per contract

**Best Practice Configuration**:
```typescript
const CHUNKING_CONFIG = {
  chunkSize: 512,              // tokens per chunk
  chunkOverlap: 128,           // 25% overlap
  preserveSentences: true,     // Don't split mid-sentence
  separator: '\n\n'            // Paragraph boundaries preferred
};
```

**Implementation**:
```typescript
// Chunk each contract's text content
function chunkContract(contract: Contract): ContractChunk[] {
  const fullText = `
    ${contract.title}
    ${contract.description}
    Authority: ${contract.authority_name}
    Location: ${contract.location}
    Value: ${contract.value ? `£${contract.value.toLocaleString()}` : 'Not specified'}
    CPV Codes: ${contract.cpv_codes.join(', ')}
  `.trim();
  
  return recursiveCharacterTextSplit(fullText, CHUNKING_CONFIG).map((chunk, idx) => ({
    id: `${contract.id}_chunk_${idx}`,
    contractId: contract.id,
    text: chunk,
    chunkIndex: idx
  }));
}
```

### 1.3 Embedding Generation

**Recommended Model**: OpenAI `text-embedding-3-small`
- **Dimensions**: 1,536 (or configurable: 256, 1,024, 1,536)
- **Cost-effective**: ~$0.02 per 1M tokens
- **Fast**: Low latency for real-time queries
- **Alternative**: `text-embedding-3-large` for better accuracy (3,072 dimensions)

**Implementation**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}

async function embedContractChunks(chunks: ContractChunk[]) {
  // Batch process for efficiency (max 2,048 inputs per request)
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(batch.map(c => c.text));
    
    batch.forEach((chunk, idx) => {
      chunk.embedding = embeddings[idx];
    });
  }
}
```

**Important**: Always use the **same embedding model** for both indexing and querying. Mixing models produces meaningless results.

### 1.4 Vector Database Storage

**Recommended Options**:

| Database | Type | Best For | Notes |
|----------|------|----------|-------|
| **Pinecone** | Managed | Production, scale | Easy to use, fully managed, generous free tier |
| **Weaviate** | Open-source | Self-hosted, flexibility | Strong hybrid search support, GraphQL API |
| **Qdrant** | Open-source | High performance | Excellent hybrid search, written in Rust |
| **pgvector** | PostgreSQL extension | Existing Postgres setup | Keep data in main database |

**Recommended: Pinecone for MVP**

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const index = pinecone.index('contracts');

// Upsert contract chunks with metadata
async function indexContractChunks(chunks: ContractChunk[]) {
  const vectors = chunks.map(chunk => ({
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      contractId: chunk.contractId,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      // Include filterable fields
      authority: chunk.contract.authority_name,
      value: chunk.contract.value,
      location: chunk.contract.location,
      buyerType: chunk.contract.buyer_type,
      deadline: chunk.contract.deadline.toISOString(),
      cpvCodes: chunk.contract.cpv_codes
    }
  }));
  
  await index.upsert(vectors);
}
```

## 2. Search Implementation (Hybrid Search + Reranking)

### 2.1 Query Processing

When a user creates an inbox with a query like: *"Construction projects over £100k in the South East"*

**Step 1: Parse Query**
```typescript
interface ParsedQuery {
  rawQuery: string;
  semanticQuery: string;        // For vector search
  keywords: string[];           // For keyword search
  extractedFilters: {           // Auto-detected filters
    minValue?: number;
    maxValue?: number;
    location?: string;
    industry?: string;
  };
}

function parseQuery(query: string): ParsedQuery {
  // Use LLM to extract structured info from natural language
  // This helps both filter application and search quality
  return {
    rawQuery: query,
    semanticQuery: query,       // Full query for semantic search
    keywords: extractKeywords(query),
    extractedFilters: extractFilters(query)
  };
}
```

**Step 2: Generate Query Embedding**
```typescript
const queryEmbedding = await generateEmbedding(parsedQuery.semanticQuery);
```

### 2.2 Hybrid Search Implementation

**Why Hybrid?** 
Research shows pure vector search alone misses important exact matches. Hybrid search combining semantic + keyword matching consistently outperforms either method alone.

**Two-Track Search**:

```typescript
interface HybridSearchConfig {
  vectorWeight: number;      // 0.7 = 70% weight to semantic
  keywordWeight: number;     // 0.3 = 30% weight to keyword
  topK: number;              // Number of candidates to retrieve
  overfetchFactor: number;   // Fetch more for reranking (2-3x)
}

async function hybridSearch(
  query: ParsedQuery,
  config: HybridSearchConfig = {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    topK: 50,
    overfetchFactor: 2
  }
): Promise<SearchResult[]> {
  
  // Track 1: Vector (Semantic) Search
  const vectorResults = await vectorSearch(
    query.semanticQuery,
    config.topK * config.overfetchFactor
  );
  
  // Track 2: Keyword (BM25) Search
  const keywordResults = await keywordSearch(
    query.keywords,
    config.topK * config.overfetchFactor
  );
  
  // Combine using Reciprocal Rank Fusion (RRF)
  const fusedResults = reciprocalRankFusion(
    vectorResults,
    keywordResults,
    config
  );
  
  return fusedResults;
}
```

**Reciprocal Rank Fusion (RRF)**:
```typescript
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  config: HybridSearchConfig
): SearchResult[] {
  const k = 60; // RRF constant (standard value)
  const scores = new Map<string, number>();
  
  // Score from vector search
  vectorResults.forEach((result, rank) => {
    const rrf = config.vectorWeight / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) || 0) + rrf);
  });
  
  // Score from keyword search
  keywordResults.forEach((result, rank) => {
    const rrf = config.keywordWeight / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) || 0) + rrf);
  });
  
  // Combine and sort
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({
      id,
      score,
      // Merge result data from both sources
    }));
}
```

### 2.3 Reranking (Critical for Quality)

**Why rerank?** 
Vector search uses compressed information (one vector per chunk). Reranking uses the full text to compute true relevance, dramatically improving the top results.

**Recommended Reranker**: Cohere (API-based) or ColBERT (open-source)

**Option 1: Cohere Rerank (Recommended for MVP)**
```typescript
import cohere from 'cohere-ai';

cohere.init(process.env.COHERE_API_KEY);

async function rerankResults(
  query: string,
  results: SearchResult[],
  topK: number = 20
): Promise<SearchResult[]> {
  const response = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query: query,
    documents: results.map(r => r.text),
    top_n: topK,
    return_documents: true
  });
  
  return response.results.map(result => ({
    ...results[result.index],
    rerankScore: result.relevance_score
  }));
}
```

**Option 2: ColBERT (Open-source)**
```typescript
import { ColBERTReranker } from '@/lib/rerankers';

const reranker = new ColBERTReranker('colbert-ir/colbertv2.0');

async function rerankResults(
  query: string,
  results: SearchResult[],
  topK: number = 20
): Promise<SearchResult[]> {
  const scores = await reranker.score(
    query,
    results.map(r => r.text)
  );
  
  return results
    .map((result, idx) => ({
      ...result,
      rerankScore: scores[idx]
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}
```

### 2.4 Filter Application

Apply structured filters **after** semantic search to narrow results:

```typescript
interface InboxFilters {
  minValue?: number;
  maxValue?: number;
  locations?: string[];
  buyerTypes?: string[];
  cpvCodes?: string[];
  deadlineAfter?: Date;
  deadlineBefore?: Date;
}

function applyFilters(
  results: SearchResult[],
  filters: InboxFilters
): SearchResult[] {
  return results.filter(result => {
    const contract = result.contract;
    
    // Value range
    if (filters.minValue && contract.value < filters.minValue) return false;
    if (filters.maxValue && contract.value > filters.maxValue) return false;
    
    // Location
    if (filters.locations?.length && 
        !filters.locations.includes(contract.location)) return false;
    
    // Buyer type
    if (filters.buyerTypes?.length && 
        !filters.buyerTypes.includes(contract.buyer_type)) return false;
    
    // CPV codes
    if (filters.cpvCodes?.length && 
        !contract.cpv_codes.some(code => filters.cpvCodes.includes(code))) return false;
    
    // Deadline
    if (filters.deadlineAfter && 
        contract.deadline < filters.deadlineAfter) return false;
    if (filters.deadlineBefore && 
        contract.deadline > filters.deadlineBefore) return false;
    
    return true;
  });
}
```

### 2.5 Match Score Calculation

Convert rerank scores to user-friendly percentages:

```typescript
function calculateMatchScore(rerankScore: number): number {
  // Rerank scores are typically in range [0, 1] but can vary
  // Normalize to 65-98% range for user display
  const minDisplay = 65;
  const maxDisplay = 98;
  
  // Apply sigmoid-like transformation
  const normalized = 1 / (1 + Math.exp(-5 * (rerankScore - 0.5)));
  
  return Math.round(minDisplay + (normalized * (maxDisplay - minDisplay)));
}
```

### 2.6 Match Explanation Generation

Use LLM to explain why each contract matched:

```typescript
async function generateMatchExplanation(
  query: string,
  contract: Contract,
  score: number
): Promise<string> {
  const prompt = `
You are explaining why a public sector contract matches a user's search criteria.

User's search: "${query}"

Contract details:
- Title: ${contract.title}
- Description: ${contract.description.slice(0, 300)}...
- Authority: ${contract.authority_name}
- Value: £${contract.value?.toLocaleString() || 'Not specified'}
- Location: ${contract.location}
- Match score: ${score}%

Provide a brief, natural explanation (2-3 sentences) of why this contract is a good match. Focus on the most relevant alignment points.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.3
  });
  
  return response.choices[0].message.content;
}
```

## 3. Complete Search Flow

```typescript
async function searchInbox(inbox: Inbox): Promise<ContractMatch[]> {
  // 1. Parse the inbox query
  const parsedQuery = parseQuery(inbox.prompt_text);
  
  // 2. Generate query embedding
  const queryEmbedding = await generateEmbedding(parsedQuery.semanticQuery);
  
  // 3. Hybrid search (vector + keyword)
  const candidates = await hybridSearch(parsedQuery, {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    topK: 50,
    overfetchFactor: 2
  });
  
  // 4. Rerank for relevance
  const reranked = await rerankResults(
    inbox.prompt_text,
    candidates,
    20  // Top 20 after reranking
  );
  
  // 5. Apply user-defined filters
  const filtered = applyFilters(reranked, inbox.filters);
  
  // 6. Deduplicate (if same contract has multiple matching chunks)
  const deduplicated = deduplicateByContract(filtered);
  
  // 7. Calculate match scores
  const scored = deduplicated.map(result => ({
    ...result,
    matchScore: calculateMatchScore(result.rerankScore)
  }));
  
  // 8. Generate explanations (can be done async/on-demand)
  const withExplanations = await Promise.all(
    scored.map(async result => ({
      ...result,
      explanation: await generateMatchExplanation(
        inbox.prompt_text,
        result.contract,
        result.matchScore
      )
    }))
  );
  
  return withExplanations;
}
```

## 4. Continuous Monitoring & Updates

### 4.1 New Contract Ingestion

```typescript
// Scheduled job (e.g., every 6 hours)
async function ingestNewContracts() {
  // 1. Fetch new contracts from API
  const newContracts = await fetchNewContractsFromAPI();
  
  // 2. Chunk contract text
  const chunks = newContracts.flatMap(chunkContract);
  
  // 3. Generate embeddings
  await embedContractChunks(chunks);
  
  // 4. Upsert to vector database
  await indexContractChunks(chunks);
  
  // 5. Trigger inbox refresh notifications
  await notifyInboxesOfNewMatches(newContracts);
}
```

### 4.2 Inbox Refresh Strategy

```typescript
// Two approaches:

// Option A: Real-time (more expensive)
// Automatically re-search each inbox when new contracts arrive
async function refreshAllInboxes() {
  const inboxes = await getAllActiveInboxes();
  for (const inbox of inboxes) {
    const newMatches = await searchInbox(inbox);
    await updateInboxMatches(inbox.id, newMatches);
  }
}

// Option B: On-demand (recommended for MVP)
// Users see "X new contracts available" badge
// Refresh happens when they open the inbox
async function refreshInboxOnDemand(inboxId: string) {
  const inbox = await getInbox(inboxId);
  const matches = await searchInbox(inbox);
  await updateInboxMatches(inboxId, matches);
  await markInboxAsRefreshed(inboxId);
}
```

## 5. Performance Optimization

### 5.1 Caching Strategy

```typescript
interface SearchCache {
  queryHash: string;
  timestamp: Date;
  results: ContractMatch[];
}

// Cache search results for identical queries
const CACHE_TTL = 3600; // 1 hour

async function cachedSearch(inbox: Inbox): Promise<ContractMatch[]> {
  const cacheKey = hashInboxQuery(inbox);
  const cached = await getFromCache(cacheKey);
  
  if (cached && !isCacheExpired(cached, CACHE_TTL)) {
    return cached.results;
  }
  
  const results = await searchInbox(inbox);
  await setInCache(cacheKey, { results, timestamp: new Date() });
  
  return results;
}
```

### 5.2 Batch Processing

```typescript
// Process multiple inbox searches in parallel
async function batchSearchInboxes(inboxIds: string[]): Promise<Map<string, ContractMatch[]>> {
  const inboxes = await getInboxes(inboxIds);
  
  const results = await Promise.all(
    inboxes.map(inbox => 
      cachedSearch(inbox).then(matches => [inbox.id, matches] as const)
    )
  );
  
  return new Map(results);
}
```

### 5.3 Lazy Loading Explanations

```typescript
// Don't generate explanations until user views contract details
async function getContractExplanation(
  contractId: string,
  inboxId: string
): Promise<string> {
  // Check cache first
  const cached = await getExplanationFromCache(contractId, inboxId);
  if (cached) return cached;
  
  // Generate on-demand
  const contract = await getContract(contractId);
  const inbox = await getInbox(inboxId);
  
  const explanation = await generateMatchExplanation(
    inbox.prompt_text,
    contract,
    85 // approximate score if not stored
  );
  
  await cacheExplanation(contractId, inboxId, explanation);
  return explanation;
}
```

## 6. Testing & Quality Metrics

### 6.1 Evaluation Dataset

Create a test set of queries and expected results:

```typescript
interface EvaluationCase {
  query: string;
  expectedContractIds: string[];
  shouldNotInclude?: string[];
}

const testCases: EvaluationCase[] = [
  {
    query: "Construction projects over £100k in the South East",
    expectedContractIds: ["contract_123", "contract_456"],
    shouldNotInclude: ["contract_789"] // IT services contract
  },
  // Add 20-50 diverse test cases
];
```

### 6.2 Quality Metrics

```typescript
interface SearchQualityMetrics {
  precision_at_5: number;    // % relevant in top 5
  recall_at_20: number;      // % relevant found in top 20
  mrr: number;               // Mean Reciprocal Rank
  ndcg: number;              // Normalized Discounted Cumulative Gain
}

async function evaluateSearchQuality(): Promise<SearchQualityMetrics> {
  // Run test cases and calculate metrics
  // Monitor regularly to catch regressions
}
```

### 6.3 A/B Testing Framework

```typescript
// Test different configurations
const experiments = {
  baseline: {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    reranker: 'cohere'
  },
  variant_a: {
    vectorWeight: 0.8,
    keywordWeight: 0.2,
    reranker: 'cohere'
  },
  variant_b: {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    reranker: 'colbert'
  }
};

// Track user engagement metrics
interface EngagementMetrics {
  saveRate: number;          // % of shown contracts saved
  hideRate: number;          // % of shown contracts hidden
  clickThroughRate: number;  // % of contracts opened
  sessionDuration: number;   // Time spent reviewing
}
```

## 7. Cost Estimation

### Typical Costs (1,000 active inboxes, 10,000 contracts)

**Embedding Generation**:
- Initial indexing: 10,000 contracts × 500 tokens avg = 5M tokens
- OpenAI cost: 5M tokens × $0.02/1M = **$0.10** one-time
- New contracts: ~100/day × 500 tokens = 50k tokens/day = **$1/month**

**Vector Database** (Pinecone):
- Free tier: 1M vectors (sufficient for MVP)
- Paid: $70/month for 5M vectors

**Reranking** (Cohere):
- Free tier: 1,000 reranks/month
- Paid: $2/1,000 searches (1,000 inboxes × 5 refreshes/month = **$10/month**)

**LLM Explanations** (OpenAI GPT-4o-mini):
- 1,000 inboxes × 20 explanations × 5 refreshes = 100k explanations/month
- ~150 tokens per explanation = 15M tokens
- Cost: 15M × $0.15/1M = **$2.25/month**

**Total estimated: ~$85/month for 1,000 active inboxes**

## 8. Implementation Checklist

### Phase 1: Core Search (Week 1-2)
- [ ] Set up OpenAI API integration
- [ ] Set up Pinecone (or chosen vector DB)
- [ ] Implement contract chunking pipeline
- [ ] Implement embedding generation
- [ ] Build vector search endpoint
- [ ] Test basic semantic search with sample data

### Phase 2: Hybrid Search (Week 3)
- [ ] Implement BM25 keyword search
- [ ] Implement RRF fusion algorithm
- [ ] Add reranking (Cohere API integration)
- [ ] Test hybrid search vs pure vector search
- [ ] Measure quality improvements

### Phase 3: Production Features (Week 4)
- [ ] Add filter application logic
- [ ] Implement match score calculation
- [ ] Build match explanation generator
- [ ] Add caching layer
- [ ] Implement contract ingestion pipeline
- [ ] Set up monitoring and logging

### Phase 4: Optimization (Week 5)
- [ ] Performance profiling
- [ ] Query optimization
- [ ] Batch processing implementation
- [ ] Cost optimization
- [ ] A/B testing framework
- [ ] Quality metrics dashboard

## 9. Recommended Tech Stack

```typescript
// Dependencies
{
  "dependencies": {
    "openai": "^4.0.0",                    // Embeddings + explanations
    "@pinecone-database/pinecone": "^2.0.0", // Vector database
    "cohere-ai": "^7.0.0",                 // Reranking
    "langchain": "^0.1.0",                 // Optional: text splitting utilities
    "@langchain/community": "^0.0.40"      // Optional: BM25 implementation
  }
}
```

## 10. Common Pitfalls & Solutions

### Problem: Poor Match Quality
**Solution**: 
- Ensure hybrid search is enabled (not just vector)
- Add reranking step
- Improve chunking strategy (preserve context)
- Use domain-specific embeddings if available

### Problem: Slow Search Performance
**Solution**:
- Enable vector database indexing (HNSW for Pinecone)
- Cache frequent queries
- Reduce overfetch factor if using reranking
- Use smaller embedding dimensions (512 vs 1,536)

### Problem: High Costs
**Solution**:
- Cache embeddings for common queries
- Use `text-embedding-3-small` instead of `-large`
- Batch reranking requests
- Generate explanations on-demand, not upfront
- Use ColBERT instead of Cohere for reranking

### Problem: Irrelevant Results
**Solution**:
- Check if query embedding matches are low (<0.5 cosine similarity)
- Add mandatory keyword filters for critical terms
- Increase keyword weight in hybrid search
- Use query expansion/reformulation

## 11. Future Enhancements

1. **User Feedback Loop**: Learn from save/hide actions to improve ranking
2. **Query Expansion**: Automatically add synonyms and related terms
3. **Multi-modal Search**: Search by uploaded documents or images
4. **Cross-lingual Search**: Support searches in multiple languages
5. **Personalized Ranking**: Adjust results based on user's past interactions
6. **Semantic Filters**: Natural language filter refinement
7. **Trend Detection**: Identify emerging contract categories

## References

- [Azure AI Search: Hybrid Retrieval Best Practices](https://techcommunity.microsoft.com/blog/azure-ai-services-blog/azure-ai-search-outperforming-vector-search-with-hybrid-retrieval-and-reranking/3929167)
- [Optimizing RAG with Hybrid Search & Reranking](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Pinecone Vector Database Docs](https://docs.pinecone.io/)
- [Cohere Rerank API](https://docs.cohere.com/docs/reranking)

---

**Document Version**: 1.0  
**Last Updated**: November 2025  
**Maintained By**: Engineering Team
