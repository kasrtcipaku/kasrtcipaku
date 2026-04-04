// lib/get-workspace-id.ts
import { createClient } from '@/lib/supabase/client'

export async function getWorkspaceId(): Promise<{ workspaceId: string | null, isMember: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    return { workspaceId: data?.workspace_id || null, isMember: false }
  }

  // Fallback ke member_session
  const res = await fetch('/api/member-session', { credentials: 'include' })
  if (!res.ok) return { workspaceId: null, isMember: false }
  const data = await res.json()
  return data.valid
    ? { workspaceId: data.workspace_id, isMember: true }
    : { workspaceId: null, isMember: false }
}