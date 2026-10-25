import { describe, expect, it } from 'vitest'

import { corsAllowOrigin, isOriginAllowed, parseOriginAllowlist } from '../originAllowlist'

describe('origin allowlist', () => {
  it('parses and trims a comma-separated list', () => {
    expect(parseOriginAllowlist(' https://old.example , https://new.example ')).toEqual([
      'https://old.example',
      'https://new.example',
    ])
  })

  it('keeps the configured origins exact', () => {
    const allowlist = parseOriginAllowlist('https://shop.example,https://preview.example')

    expect(isOriginAllowed('https://shop.example', allowlist)).toBe(true)
    expect(isOriginAllowed('https://preview.example', allowlist)).toBe(true)
    expect(isOriginAllowed('https://sub.shop.example', allowlist)).toBe(false)
    expect(isOriginAllowed(null, allowlist)).toBe(false)
  })

  it('returns wildcard only when no origin list is configured', () => {
    expect(corsAllowOrigin('https://shop.example', [])).toBe('*')
    expect(corsAllowOrigin('https://shop.example', ['https://shop.example'])).toBe(
      'https://shop.example',
    )
    expect(corsAllowOrigin('https://other.example', ['https://shop.example'])).toBe('null')
  })
})
