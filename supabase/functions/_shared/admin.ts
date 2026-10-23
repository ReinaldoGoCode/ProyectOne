import { createClient } from 'npm:@supabase/supabase-js@2'
import { getServiceClient } from './http.ts'

export async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!bearer || !url || !anonKey) return null

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await authClient.auth.getUser(bearer)
  if (error || !data.user) return null
  const service = getServiceClient()
  const { data: membership, error: membershipError } = await service
    .from('admin_users')
    .select('user_id')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .maybeSingle()
  if (membershipError || !membership) return null
  return { userId: data.user.id, service }
}
