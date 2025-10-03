'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SpreadsheetEditor } from '@/components/spreadsheet/SpreadsheetEditor'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useFileStorage } from '@/hooks/use-file-storage'

function EditPageContent() {
  const { fileId } = useParams()
  const router = useRouter()
  const { fileCount } = useFileStorage()
  const { open } = useSidebar()

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
    <div className="min-h-screen bg-background">
      {/* Header with Sidebar Toggle */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            {!open && fileCount > 0 && (
              <Badge variant="secondary" className="mr-2">
                {fileCount}
              </Badge>
            )}
            <SidebarTrigger className="h-8 w-8" />
          </div>
          <div className="flex items-center space-x-2">
            <img
              src="/FluffyVisualizer.png"
              alt="FluffyViz Logo"
              className="w-8 h-8 object-contain rounded-md"
            />
            <h1 className="text-xl font-bold text-primary">FluffyViz</h1>
          </div>
        </div>
      </div>

      {/* Spreadsheet Editor */}
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
