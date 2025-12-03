'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SpreadsheetEditor } from '@/components/spreadsheet/SpreadsheetEditor'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar'

function EditPageContent() {
  const { fileId } = useParams()
  const router = useRouter()

  // Listen for file deletion and selection events
  useEffect(() => {
    const handleFileDeleted = (event: CustomEvent<{ fileId: string }>) => {
      // If the deleted file is the current file, redirect to homepage
      if (event.detail.fileId === fileId) {
        router.push('/')
      }
    }

    const handleAllFilesDeleted = () => {
      // If all files are deleted, redirect to homepage
      router.push('/')
    }

    const handleFileSelected = (event: CustomEvent<{ file: File; source: string; storedFileId?: string }>) => {
      // If a file is selected from the sidebar, navigate to its edit page
      if (event.detail.storedFileId && event.detail.storedFileId !== fileId) {
        router.push(`/edit/${event.detail.storedFileId}`)
      }
    }

    window.addEventListener('fileDeleted', handleFileDeleted as EventListener)
    window.addEventListener('allFilesDeleted', handleAllFilesDeleted as EventListener)
    window.addEventListener('fileSelected', handleFileSelected as EventListener)

    return () => {
      window.removeEventListener('fileDeleted', handleFileDeleted as EventListener)
      window.removeEventListener('allFilesDeleted', handleAllFilesDeleted as EventListener)
      window.removeEventListener('fileSelected', handleFileSelected as EventListener)
    }
  }, [fileId, router])

  return (
    <div className="min-h-screen bg-background pt-2">
      <SpreadsheetEditor fileId={fileId as string} />
    </div>
  )
}

export default function EditPage() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <EditPageContent />
      </SidebarInset>
    </SidebarProvider>
  )
}
