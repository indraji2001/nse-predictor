import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// DELETE /api/papertrade/delete?id=XXX
// OR POST /api/papertrade/delete with { id } body
// Removes a paper trade from tracking.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }
  try {
    await db.paperTrade.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
  }
}

// POST /api/papertrade/delete with body { id } — closes the trade (sets status to CLOSED)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, action } = body as { id?: string; action?: string }
  if (!id) {
    return NextResponse.json({ error: 'Missing id in body' }, { status: 400 })
  }
  if (action === 'close') {
    // Mark as closed manually (user exited the trade)
    await db.paperTrade.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() },
    })
    return NextResponse.json({ ok: true, message: 'Trade closed' })
  }
  // Default: delete the trade
  try {
    await db.paperTrade.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
  }
}
