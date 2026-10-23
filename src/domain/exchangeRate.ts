import type { ExchangeQuote } from './types'

/** Clearly fictional display rate used only by the browser demo. */
export const DEMO_VES_PER_USD = '40.00'
export const DEMO_QUOTE_TTL_MS = 15 * 60 * 1000

export function createDemoExchangeQuote(now = new Date()): ExchangeQuote {
  return {
    vesPerUsd: DEMO_VES_PER_USD,
    source: 'demo_ficticia',
    quotedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEMO_QUOTE_TTL_MS).toISOString(),
  }
}
