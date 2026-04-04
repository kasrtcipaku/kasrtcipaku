import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MemberDashboardPlaceholder from './_member-placeholder'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <MemberDashboardPlaceholder />
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, type)')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .limit(1)

  if (!memberships || memberships.length === 0) redirect('/setup')

  const workspace = (memberships[0] as any).workspaces
  if (!workspace) redirect('/setup')

  const now      = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: transactions },
    { data: unpaidBills, count: unpaidCount },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('workspace_id', workspace.id)
      .gte('date', firstDay)
      .lte('date', lastDay),
    supabase
      .from('bills')
      .select('id, title, amount, due_date', { count: 'exact' })
      .eq('workspace_id', workspace.id)
      .eq('status', 'unpaid')
      .order('due_date', { ascending: true })
      .limit(3),
    supabase
      .from('transactions')
      .select('id, type, amount, description, date, categories(name, icon)')
      .eq('workspace_id', workspace.id)
      .order('date', { ascending: false })
      .limit(5),
  ])

  const totalIncome  = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) || 0
  const totalExpense = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0
  const balance      = totalIncome - totalExpense
  const incomeCount  = transactions?.filter(t => t.type === 'income').length || 0
  const expenseCount = transactions?.filter(t => t.type === 'expense').length || 0

  const fmt       = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  const bulan     = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const typeLabel: Record<string, string> = { rt: 'RT / RW', kosan: 'Kosan', warteg: 'Warteg / Usaha', personal: 'Personal' }

  const ACCENT  = '#7AAACE'
  const card    = { background: '#fff', borderRadius: 12, border: '1px solid #E8E0D4', padding: '16px 18px' } as const
  const divider = { borderTop: '1px solid #F2EDE5', margin: '0' } as const

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {typeLabel[workspace.type] || workspace.type}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: '3px 0 4px' }}>
          {workspace.name}
        </h2>
        <p style={{ fontSize: 12, color: '#8B7E6E', margin: 0 }}>Ringkasan {bulan}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E', marginBottom: 6 }}>Saldo Bulan Ini</div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: balance >= 0 ? '#15803D' : '#DC2626' }}>
            {fmt(balance)}
          </div>
          <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: balance >= 0 ? '#F0FDF4' : '#FEF2F2', color: balance >= 0 ? '#15803D' : '#DC2626' }}>
            {balance >= 0 ? '↑ Surplus' : '↓ Defisit'}
          </span>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E', marginBottom: 6 }}>Total Pemasukan</div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: '#15803D' }}>{fmt(totalIncome)}</div>
          <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#F0FDF4', color: '#15803D' }}>
            {incomeCount} transaksi
          </span>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E', marginBottom: 6 }}>Total Pengeluaran</div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: '#DC2626' }}>{fmt(totalExpense)}</div>
          <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626' }}>
            {expenseCount} transaksi
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: 0 }}>Tagihan Belum Dibayar</h3>
            {unpaidCount && unpaidCount > 0 ? (
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626' }}>
                {unpaidCount} tagihan
              </span>
            ) : null}
          </div>
          {!unpaidBills || unpaidBills.length === 0 ? (
            <p style={{ fontSize: 12, color: '#8B7E6E', margin: '0 0 12px' }}>Semua tagihan sudah lunas ✅</p>
          ) : (
            <div>
              {unpaidBills.map((bill: any, i: number) => (
                <div key={bill.id}>
                  {i > 0 && <div style={divider} />}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18' }}>{bill.title}</div>
                      <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>
                        Jatuh tempo: {new Date(bill.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>{fmt(bill.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href="/dashboard/tagihan" style={{ display: 'block', textAlign: 'center', fontSize: 11.5, fontWeight: 500, color: ACCENT, textDecoration: 'none', marginTop: 4 }}>
            Lihat semua tagihan →
          </a>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: 0 }}>Transaksi Terbaru</h3>
            <a href="/dashboard/transaksi" style={{ fontSize: 11, fontWeight: 500, color: ACCENT, textDecoration: 'none' }}>Lihat semua</a>
          </div>
          {!recentTransactions || recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 12, color: '#8B7E6E', margin: '0 0 12px' }}>Belum ada transaksi bulan ini</p>
              <a href="/dashboard/transaksi/baru" style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, color: '#fff', padding: '7px 16px', borderRadius: 8, background: ACCENT, textDecoration: 'none' }}>
                + Tambah Transaksi
              </a>
            </div>
          ) : (
            <div>
              {recentTransactions.map((t: any, i: number) => (
                <div key={t.id}>
                  {i > 0 && <div style={divider} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F0EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      {t.categories?.icon || '💰'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description || t.categories?.name || '-'}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>
                        {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: t.type === 'income' ? '#15803D' : '#DC2626' }}>
                      {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: '0 0 12px' }}>Aksi Cepat</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { href: '/dashboard/transaksi/baru?type=income',  label: '+ Catat Pemasukan',  bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
            { href: '/dashboard/transaksi/baru?type=expense', label: '− Catat Pengeluaran', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
            { href: '/dashboard/tagihan/baru',                label: '📋 Tambah Tagihan',   bg: '#F5F0EA', color: '#3d3a35', border: '#D4CFC4' },
            { href: '/dashboard/laporan',                     label: '📊 Lihat Laporan',    bg: '#F5F0EA', color: '#3d3a35', border: '#D4CFC4' },
          ].map(a => (
            <a key={a.href} href={a.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 11.5, fontWeight: 500, textDecoration: 'none', background: a.bg, color: a.color, border: `1px solid ${a.border}` }}>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}