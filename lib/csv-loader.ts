/**
 * CSV Loader - Parse and transform contract data from CSV
 * Maps 30-column CSV to simplified Contract type
 */

import { parse } from 'csv-parse/browser/esm/sync'
import type { Contract, RawContractCSV } from '@/types'

/**
 * Parse contract value from string to number
 * Handles various formats: "50000", "50,000", "GBP 50000", etc.
 */
function parseValue(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[£$€,\s]/g, '')
  const parsed = parseFloat(cleaned)

  return isNaN(parsed) ? null : parsed
}

/**
 * Parse date from CSV format (YYYY-MM-DD) to ISO string
 */
function parseDate(date: string | undefined): string {
  if (!date || date.trim() === '') {
    return new Date().toISOString()
  }

  try {
    return new Date(date).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Clean HTML entities in description
 * e.g., "&amp;" → "&", "&lt;" → "<"
 */
function cleanDescription(text: string | undefined): string {
  if (!text) return ''

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Transform raw CSV row to Contract type
 */
function transformContract(raw: any): Contract {
  const id = raw.Guid || `contract-${Date.now()}-${Math.random()}`

  return {
    id,
    title: raw.Title || 'Untitled Contract',
    description: cleanDescription(raw.Description),
    authority: raw['Buyer name'] || 'Unknown Authority',
    value: parseValue(raw.Value),
    closeDate: parseDate(raw['Close date']),
    publishDate: parseDate(raw['Publish date']),
    url: raw.URL || '',
    buyerClassification: raw['Buyer Classification'] || 'Other',

    // UI state - defaults for new contracts
    isNew: true,
    isSaved: false,
    isUnread: true,
    hiddenInInboxes: [], // Not hidden in any inbox initially
  }
}

/**
 * Load and parse contracts from CSV file
 * Returns array of Contract objects ready for IndexedDB
 */
export async function loadContractsFromCSV(csvPath: string): Promise<Contract[]> {
  try {
    console.log('[CSV Loader] Loading contracts from:', csvPath)

    // Fetch CSV file
    const response = await fetch(csvPath)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`)
    }

    const csvText = await response.text()
    console.log('[CSV Loader] CSV file loaded, size:', csvText.length, 'bytes')

    // Parse CSV
    const records = parse(csvText, {
      columns: true, // Use first row as column names
      skip_empty_lines: true,
      trim: true,
    })

    console.log('[CSV Loader] Parsed', records.length, 'raw records')

    // Transform to Contract type
    const contracts = records.map(transformContract)

    console.log('[CSV Loader] Transformed', contracts.length, 'contracts')

    // Log sample for debugging
    if (contracts.length > 0) {
      console.log('[CSV Loader] Sample contract:', {
        id: contracts[0].id,
        title: contracts[0].title.substring(0, 50) + '...',
        authority: contracts[0].authority,
        value: contracts[0].value,
      })
    }

    return contracts
  } catch (error) {
    console.error('[CSV Loader] Error loading contracts:', error)
    throw error
  }
}

/**
 * Load contracts from local CSV in /data directory
 * Helper function for easy imports
 */
export async function loadLocalContracts(): Promise<Contract[]> {
  return loadContractsFromCSV('/data/contracts.csv')
}

/**
 * Validate contract data quality
 * Returns array of warnings for contracts with issues
 */
export function validateContracts(contracts: Contract[]): string[] {
  const warnings: string[] = []

  contracts.forEach((contract, index) => {
    if (!contract.title || contract.title === 'Untitled Contract') {
      warnings.push(`Contract ${index + 1} (${contract.id}): Missing title`)
    }

    if (!contract.description || contract.description.length < 20) {
      warnings.push(`Contract ${index + 1} (${contract.id}): Description too short`)
    }

    if (!contract.value) {
      warnings.push(`Contract ${index + 1} (${contract.id}): Missing value`)
    }

    if (contract.authority === 'Unknown Authority') {
      warnings.push(`Contract ${index + 1} (${contract.id}): Unknown authority`)
    }
  })

  return warnings
}

/**
 * Get statistics about loaded contracts
 */
export function getContractStats(contracts: Contract[]) {
  const totalContracts = contracts.length
  const withValue = contracts.filter(c => c.value !== null).length
  const withDescription = contracts.filter(c => c.description.length > 0).length
  const avgValue = contracts
    .filter(c => c.value !== null)
    .reduce((sum, c) => sum + (c.value || 0), 0) / withValue

  const byClassification = contracts.reduce((acc, c) => {
    acc[c.buyerClassification] = (acc[c.buyerClassification] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalContracts,
    withValue,
    withDescription,
    avgValue: Math.round(avgValue),
    byClassification,
  }
}
