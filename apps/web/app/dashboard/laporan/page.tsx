'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'

type Transaction = {
  id: string; type: string; amount: number; date: string
  categories: { name: string } | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n)

const fmtFull = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const MONTHS        = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
const ACCENT        = '#7AAACE'
const ACCENT_D      = '#5E96C0'
const EXPENSE_COLORS = ['#DC2626','#EA580C','#F97316','#FB923C','#FCA5A5','#FEE2E2']

export default function LaporanPage() {
  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [loading, setLoading]             = useState(true)
  const [workspaceId, setWorkspaceId]     = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear())
  const [chartType, setChartType]         = useState<'bar' | 'line'>('bar')
  const [exportLoading, setExportLoading] = useState(false)
  const [activeTab, setActiveTab]         = useState<'overview' | 'category' | 'trend'>('overview')
  const [exportHover, setExportHover]     = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: m } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(name)')
        .eq('user_id', user.id).limit(1)
      if (!m?.length) return
      setWorkspaceId(m[0].workspace_id)
      setWorkspaceName((m[0] as any).workspaces?.name || 'Workspace')
      fetchData(m[0].workspace_id, selectedMonth, selectedYear)
    })
  }, [])

  useEffect(() => {
    if (workspaceId) fetchData(workspaceId, selectedMonth, selectedYear)
  }, [selectedMonth, selectedYear, workspaceId])

  const fetchData = async (wsId: string, month: number, year: number) => {
    setLoading(true)
    const supabase = createClient()
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to   = new Date(year, month + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('transactions')
      .select('id, type, amount, date, categories(name)')
      .eq('workspace_id', wsId)
      .gte('date', from).lte('date', to)
      .order('date', { ascending: true })
    setTransactions((data as any[]) || [])
    setLoading(false)
  }

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance      = totalIncome - totalExpense
  const incomeCount  = transactions.filter(t => t.type === 'income').length
  const expenseCount = transactions.filter(t => t.type === 'expense').length

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const dailyData   = Array.from({ length: daysInMonth }, (_, i) => {
    const day    = i + 1
    const dayStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayTx  = transactions.filter(t => t.date === dayStr)
    return {
      day,
      pemasukan:   dayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      pengeluaran: dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }
  }).filter(d => d.pemasukan > 0 || d.pengeluaran > 0)

  const catMap: Record<string, { name: string; amount: number; count: number }> = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const key = t.categories?.name || 'Lainnya'
    if (!catMap[key]) catMap[key] = { name: key, amount: 0, count: 0 }
    catMap[key].amount += t.amount
    catMap[key].count  += 1
  })
  const categoryData = Object.values(catMap).sort((a, b) => b.amount - a.amount)

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(selectedYear, selectedMonth - 5 + i, 1)
    return { label: MONTHS[d.getMonth()], month: d.getMonth(), year: d.getFullYear() }
  })

  const handleExportPDF = async () => {
    setExportLoading(true)
    const { default: jsPDF }      = await import('jspdf')
    const { default: autoTable }  = await import('jspdf-autotable')
    const doc   = new jsPDF()
    const bulan = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    doc.setFontSize(20); doc.text('Laporan Keuangan', 14, 20)
    doc.setFontSize(12); doc.text(workspaceName, 14, 30)
    doc.setFontSize(10); doc.text(`Periode: ${bulan}`, 14, 38)
    doc.setDrawColor(212, 207, 196); doc.line(14, 42, 196, 42)

    doc.setFontSize(11); doc.text('Ringkasan', 14, 52)
    doc.setFontSize(9)
    doc.text(`Total Pemasukan : ${fmtFull(totalIncome)}`,  14, 60)
    doc.text(`Total Pengeluaran: ${fmtFull(totalExpense)}`, 14, 67)
    doc.text(`Saldo            : ${fmtFull(balance)}`,      14, 74)

    autoTable(doc, {
      startY: 82,
      head: [['Tanggal', 'Kategori', 'Jenis', 'Nominal']],
      body: transactions.map(t => [
        new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        t.categories?.name || '-',
        t.type === 'income' ? 'Masuk' : 'Keluar',
        fmtFull(t.amount),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [122, 170, 206] },
      alternateRowStyles: { fillColor: [245, 242, 235] },
    })

    doc.save(`laporan-${bulan.replace(' ', '-').toLowerCase()}.pdf`)
    setExportLoading(false)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid #E8E0D4', borderRadius: 10, padding: '10px 14px', fontSize: 11 }}>
        <p style={{ fontWeight: 600, color: '#1A1A18', marginBottom: 5 }}>Hari ke-{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, marginBottom: 2 }}>{p.name}: {fmtFull(p.value)}</p>
        ))}
      </div>
    )
  }

  const years = [selectedYear - 1, selectedYear, selectedYear + 1].filter(y => y <= new Date().getFullYear())

  // Shared styles
  const card = { background: '#fff', border: '1px solid #E8E0D4', borderRadius: 12 } as const
  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #E0D9CE', borderRadius: 8,
    fontSize: 12.5, background: '#fff', color: '#1A1A18', fontFamily: 'inherit', cursor: 'pointer',
  }
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px', border: 'none', borderRadius: 7,
    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1A1A18' : '#6B6860',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes kasrt-fade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .kasrt-section { animation: kasrt-fade 0.35s ease forwards; }
        .kasrt-select:focus { outline: none; border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(122,170,206,0.18); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: 0 }}>Laporan</h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', marginTop: 3 }}>{workspaceName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="kasrt-select"
            style={selectStyle}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="kasrt-select"
            style={selectStyle}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleExportPDF}
            disabled={exportLoading || transactions.length === 0}
            onMouseEnter={() => setExportHover(true)}
            onMouseLeave={() => setExportHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: exportLoading || transactions.length === 0 ? '#B0CEDE' : exportHover ? ACCENT_D : ACCENT,
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 12.5, fontWeight: 500, cursor: exportLoading || transactions.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 12h10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {exportLoading ? 'Mengekspor...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }} className="kasrt-section">
        {[
          { label: 'Total Pemasukan',  value: totalIncome,  color: '#15803D', sub: `${incomeCount} transaksi`,  subColor: '#8B7E6E' },
          { label: 'Total Pengeluaran', value: totalExpense, color: '#DC2626', sub: `${expenseCount} transaksi`, subColor: '#8B7E6E' },
          { label: 'Saldo Bersih', value: balance,
            color: balance >= 0 ? '#15803D' : '#DC2626',
            sub: balance >= 0 ? '↑ Surplus' : '↓ Defisit',
            subColor: balance >= 0 ? '#15803D' : '#DC2626' },
        ].map((c, i) => (
          <div key={i} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E', marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: c.color, letterSpacing: '-0.3px' }}>{fmtFull(c.value)}</div>
            <div style={{ fontSize: 10.5, color: c.subColor, marginTop: 5 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F5F0EA', padding: 4, borderRadius: 10, marginBottom: 12 }}>
        {([
          { key: 'overview', label: 'Grafik' },
          { key: 'category', label: 'Kategori' },
          { key: 'trend',    label: 'Tren' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(activeTab === tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart card */}
      <div style={{ ...card, padding: 18, marginBottom: 12 }} className="kasrt-section">
        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: '#8B7E6E' }}>Memuat data...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="4" y="20" width="6" height="12" rx="2" fill="#E0D9CE"/><rect x="15" y="12" width="6" height="20" rx="2" fill="#E0D9CE"/><rect x="26" y="6" width="6" height="26" rx="2" fill="#E0D9CE"/></svg>
            <p style={{ fontSize: 13, color: '#8B7E6E' }}>Belum ada data untuk periode ini</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: 0 }}>
                    Transaksi Harian — {MONTHS[selectedMonth]} {selectedYear}
                  </h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['bar', 'line'] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => setChartType(c)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: 'none',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          background: chartType === c ? ACCENT : '#F5F0EA',
                          color: chartType === c ? '#fff' : '#6B6860',
                          transition: 'background 0.12s',
                        }}
                      >
                        {c === 'bar' ? 'Batang' : 'Garis'}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  {chartType === 'bar' ? (
                    <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE5" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8B7E6E' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#8B7E6E' }} tickFormatter={v => fmt(v)} width={58} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F0EA', radius: 4 }} />
                      <Bar dataKey="pemasukan"   name="Pemasukan"   fill="#15803D" radius={[4,4,0,0]} maxBarSize={18} />
                      <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#DC2626" radius={[4,4,0,0]} maxBarSize={18} />
                    </BarChart>
                  ) : (
                    <LineChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE5" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8B7E6E' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#8B7E6E' }} tickFormatter={v => fmt(v)} width={58} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="pemasukan"   name="Pemasukan"   stroke="#15803D" strokeWidth={2} dot={{ r: 3, fill: '#15803D' }} />
                      <Line type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="#DC2626" strokeWidth={2} dot={{ r: 3, fill: '#DC2626' }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                  {[{ color: '#15803D', label: 'Pemasukan' }, { color: '#DC2626', label: 'Pengeluaran' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8B7E6E' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'category' && (
              <div>
                <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: '0 0 16px' }}>Pengeluaran per Kategori</h3>
                {categoryData.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#8B7E6E', textAlign: 'center', padding: '32px 0' }}>Tidak ada pengeluaran bulan ini</p>
                ) : (
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: 180, height: 180, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72}>
                            {categoryData.map((_, i) => (
                              <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => fmtFull(v as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {categoryData.map((cat, i) => (
                        <div key={cat.name}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: EXPENSE_COLORS[i % EXPENSE_COLORS.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18', flex: 1 }}>{cat.name}</span>
                            <span style={{ fontSize: 11.5, color: '#8B7E6E', whiteSpace: 'nowrap' }}>{fmtFull(cat.amount)}</span>
                          </div>
                          <div style={{ height: 5, background: '#F5F0EA', borderRadius: 99, overflow: 'hidden', marginLeft: 18 }}>
                            <div style={{ height: '100%', borderRadius: 99, background: EXPENSE_COLORS[i % EXPENSE_COLORS.length], width: `${(cat.amount / totalExpense) * 100}%`, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trend' && (
              <div>
                <h3 style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', margin: '0 0 6px' }}>Tren 6 Bulan Terakhir</h3>
                <p style={{ fontSize: 11.5, color: '#8B7E6E', marginBottom: 16 }}>Klik bulan lain untuk melihat data historis.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                  {trendData.map((m, i) => {
                    const isCurrent = m.month === selectedMonth && m.year === selectedYear
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedMonth(m.month); setSelectedYear(m.year) }}
                        style={{
                          padding: '10px 6px', border: `1px solid ${isCurrent ? ACCENT : '#E0D9CE'}`,
                          borderRadius: 9, background: isCurrent ? '#EBF4FB' : '#FAFAF8',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                          transition: 'border-color 0.12s, background 0.12s',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? ACCENT_D : '#1A1A18' }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: '#8B7E6E', marginTop: 2 }}>{m.year}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction list */}
      {transactions.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }} className="kasrt-section">
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 130px', padding: '10px 18px', borderBottom: '1px solid #F2EDE5', background: '#FAFAF8' }}>
            {['Transaksi', 'Tanggal', 'Jumlah'].map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 2 ? 'right' : 'left' }}>
                {h}
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {transactions.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 100px 130px',
                  alignItems: 'center', padding: '10px 18px',
                  borderBottom: i < transactions.length - 1 ? '1px solid #F5F1EC' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: t.type === 'income' ? '#F0FDF4' : '#FEF2F2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600,
                    color: t.type === 'income' ? '#15803D' : '#DC2626',
                  }}>
                    {t.type === 'income' ? '↑' : '↓'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.categories?.name || (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 1 }}>
                      {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#8B7E6E' }}>
                  {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', color: t.type === 'income' ? '#15803D' : '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                  {t.type === 'income' ? '+' : '−'}{fmtFull(t.amount)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 18px', borderTop: '1px solid #F2EDE5', background: '#FAFAF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: '#8B7E6E' }}>{transactions.length} transaksi</span>
            <span style={{ fontSize: 11.5, color: '#8B7E6E' }}>
              {MONTHS[selectedMonth]} {selectedYear}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}