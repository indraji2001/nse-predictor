import { NextRequest, NextResponse } from 'next/server'
import { listArchive, deleteArchivedFile } from '@/lib/stocks/nse-bhavcopy'

export const dynamic = 'force-dynamic'

// GET /api/bhavcopy/list — list all archived bhavcopy files
// Optional: ?delete=YYYY-MM-DD to delete a specific date
export async function GET(req: NextRequest) {
  const deleteDate = req.nextUrl.searchParams.get('delete')
  if (deleteDate) {
    await deleteArchivedFile(deleteDate)
    return NextResponse.json({ ok: true, deleted: deleteDate })
  }
  const files = await listArchive()
  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)
  return NextResponse.json({
    files,
    count: files.length,
    totalSizeBytes: totalSize,
    oldestDate: files[files.length - 1]?.date ?? null,
    newestDate: files[0]?.date ?? null,
  })
}
