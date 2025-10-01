'use client'

import { useParams } from 'next/navigation'
import { SpreadsheetEditor } from '@/components/spreadsheet/SpreadsheetEditor'

export default function EditPage() {
  const { fileId } = useParams()
  return <SpreadsheetEditor fileId={fileId as string} />
}
