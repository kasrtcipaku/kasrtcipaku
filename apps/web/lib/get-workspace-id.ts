// lib/get-workspace-id.ts
import { createClient } from '@/lib/supabase/client'

export async function getWorkspaceId(): Promise<{ workspaceId: string | null; isMember: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Selalu prioritaskan workspace yang dimiliki (role = owner)
    // Jangan ambil workspace orang lain yang kebetulan jadi anggota
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')   // ← filter owner saja
      .limit(1)
      .maybeSingle()

    if (data?.workspace_id) {
      return { workspaceId: data.workspace_id, isMember: false }
    }

    // User punya Supabase Auth tapi bukan owner workspace apapun
    // (edge case: sign out belum selesai dari alur join)
    // Jangan fallback ke workspace orang lain — return null
    return { workspaceId: null, isMember: false }
  }

  // Tidak ada Supabase Auth session → cek member_session cookie (jalur anggota)
  const res = await fetch('/api/member-session', { credentials: 'include' })
  if (!res.ok) return { workspaceId: null, isMember: false }
  const data = await res.json()
  return data.valid
    ? { workspaceId: data.workspace_id, isMember: true }
    : { workspaceId: null, isMember: false }
}