export function parseOriginAllowlist(value: string | null | undefined): readonly string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function isOriginAllowed(
  requestOrigin: string | null,
  allowlist: readonly string[],
): boolean {
  return allowlist.length === 0 || (requestOrigin !== null && allowlist.includes(requestOrigin))
}

export function corsAllowOrigin(
  requestOrigin: string | null,
  allowlist: readonly string[],
): string {
  if (allowlist.length === 0) return '*'
  return requestOrigin !== null && allowlist.includes(requestOrigin) ? requestOrigin : 'null'
}
