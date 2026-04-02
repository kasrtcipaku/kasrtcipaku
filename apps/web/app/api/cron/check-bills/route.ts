import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // ─── Validasi via Header (bukan query param) ────────────────────────────────
  // Di cron-job.org: tambahkan header  x-cron-secret: [CRON_SECRET]
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // H-3
  const h3 = new Date(today)
  h3.setDate(h3.getDate() + 3)
  const h3Str = h3.toISOString().split('T')[0]

  // ─── Ambil tagihan unpaid yang jatuh tempo hari ini atau H-3 ───────────────
  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, title, amount, due_date, frequency, workspace_id')
    .eq('status', 'unpaid')
    .in('due_date', [todayStr, h3Str])

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bills || bills.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Tidak ada tagihan hari ini' })
  }

  // ─── Ambil telegram_links per workspace ────────────────────────────────────
  // Kolom: telegram_id (bukan telegram_chat_id — sesuai schema Fase 3)
  const workspaceIds = [...new Set(bills.map(b => b.workspace_id))]
  const { data: links } = await supabase
    .from('telegram_links')
    .select('workspace_id, telegram_id')
    .in('workspace_id', workspaceIds)
    .eq('is_active', true)  // hanya yang aktif

  if (!links || links.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: 'Tidak ada workspace yang terhubung ke Telegram',
    })
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  let sent = 0
  const errors: string[] = []

  for (const bill of bills) {
    const chatLinks = links.filter(l => l.workspace_id === bill.workspace_id)
    if (chatLinks.length === 0) continue

    const isToday = bill.due_date === todayStr
    const freqLabel =
      bill.frequency === 'monthly' ? ' · Bulanan'
      : bill.frequency === 'weekly' ? ' · Mingguan'
      : ''

    const label = isToday
      ? '⚠️ Jatuh tempo *HARI INI*'
      : '📅 Jatuh tempo *3 hari lagi*'

    const nominalFmt = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(bill.amount)

    // Tambah offset +7 agar tanggal tidak geser akibat UTC
    const dueFmt = new Date(bill.due_date + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const msg =
      `${label}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 ${bill.title}${freqLabel}\n` +
      `💰 ${nominalFmt}\n` +
      `📆 ${dueFmt}\n\n` +
      `Ketik /lunas untuk tandai sudah dibayar.`

    for (const link of chatLinks) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: link.telegram_id,   // ← difix: telegram_id
              text: msg,
              parse_mode: 'Markdown',
            }),
          }
        )
        const result = await res.json()
        if (result.ok) {
          sent++
        } else {
          errors.push(`chat ${link.telegram_id}: ${result.description}`)
        }
      } catch (e) {
        errors.push(`fetch error: ${e}`)
      }
    }
  }

  return NextResponse.json({
    sent,
    bills_found: bills.length,
    ...(errors.length > 0 && { errors }),
  })
}