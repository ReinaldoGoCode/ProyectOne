import {
  corsAllowOrigin,
  isOriginAllowed as isRequestOriginAllowed,
  parseOriginAllowlist,
} from '../../../src/domain/originAllowlist.ts'

export function corsHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get('origin')
  const allowedOrigins = parseOriginAllowlist(Deno.env.get('ALLOWED_ORIGIN'))
  return {
    'Access-Control-Allow-Origin': corsAllowOrigin(requestOrigin, allowedOrigins),
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info, x-hub-signature-256',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  }
}

export function json(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

export function isAllowedOrigin(request: Request): boolean {
  const allowedOrigins = parseOriginAllowlist(Deno.env.get('ALLOWED_ORIGIN'))
  return isRequestOriginAllowed(request.headers.get('origin'), allowedOrigins)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Backend service credentials are not configured.')
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

import { createClient } from 'npm:@supabase/supabase-js@2'
