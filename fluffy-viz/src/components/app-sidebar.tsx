"use client"

import React, { useState, useCallback } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Upload as UploadIcon,
  Trash2,
  Edit
} from "lucide-react"
import { useFileStorage, StoredFile } from "@/hooks/use-file-storage"
import { formatDistanceToNow } from "date-fns"
import { FileSelectionEventDetail } from "@/types/file-storage"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AIProviderConfigDemo } from "@/components/ai-provider-config-demo"
import { useHasConfiguredProviders } from "@/hooks/use-provider-config"

export function AppSidebar() {
  const { files, fileCount, deleteFile, clearAllFiles, renameFile } = useFileStorage()
  const hasConfiguredProviders = useHasConfiguredProviders()
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToRename, setFileToRename] = useState<StoredFile | null>(null)
  const [newFileName, setNewFileName] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [providerDialogOpen, setProviderDialogOpen] = useState(false)

  const emitFileSelected = useCallback((detail: FileSelectionEventDetail) => {
    const event = new CustomEvent<FileSelectionEventDetail>('fileSelected', { detail })
    window.dispatchEvent(event)
  }, [])

  const emitFileDeleted = useCallback((fileId: string) => {
    const event = new CustomEvent('fileDeleted', { detail: { fileId } })
    window.dispatchEvent(event)
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      emitFileSelected({
        file: e.dataTransfer.files[0],
        source: 'sidebar-upload'
      })
    }
  }, [emitFileSelected])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      emitFileSelected({
        file: e.target.files[0],
        source: 'sidebar-upload'
      })
    }
  }

  const handleFileClick = (file: StoredFile) => {
    // Create a File object from the stored content
    const blob = new Blob([file.content], { type: file.mimeType })
    const fileObject = new File([blob], file.name, {
      type: file.mimeType,
      lastModified: file.lastModified
    })
    emitFileSelected({
      file: fileObject,
      source: 'sidebar-stored',
      storedFileId: file.id,
      skipInitialSave: true
    })
  }

  const handleRename = () => {
    if (fileToRename && newFileName.trim()) {
      renameFile(fileToRename.id, newFileName.trim())
      setRenameDialogOpen(false)
      setFileToRename(null)
      setNewFileName("")
    }
  }

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFormatBadge = (format: string) => {
    const formatMap: { [key: string]: string } = {
      'message-centric': 'MESSAGE CENTRIC',
      'langfuse': 'LANGFUSE',
      'langsmith': 'LANGSMITH',
      'arize': 'ARIZE',
      'turn-level': 'TURN LEVEL'
    }
    return formatMap[format] || format.toUpperCase()
  }

  return (
    <>
      <Sidebar
        side="left"
        className="border-r"
        style={{ backgroundColor: '#D1CCDC' }}
      >
        <SidebarContent className="flex flex-col justify-between min-h-full">
          {/* Agent Datasets Section */}
          <SidebarGroup className="flex-1">
            <SidebarGroupLabel className="text-lg font-semibold px-4 py-3 flex items-center justify-between">
              <span>Agent Datasets</span>
              <Badge variant="secondary" className="ml-2">
                {fileCount}
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent className="p-4 space-y-4">
              {/* Upload Button */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg py-4 px-4 text-center transition-all duration-200 cursor-pointer",
                  dragActive ? 'border-primary bg-primary/10' : 'border-neutral-300 hover:border-primary hover:bg-primary/5'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('sidebar-file-upload')?.click()}
              >
                <div className="flex items-center justify-center text-sm font-medium">
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Drop or click to import a file
                </div>
                <input
                  type="file"
                  accept=".csv,.json,.jsonl,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="sidebar-file-upload"
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white rounded-lg p-3 border border-gray-200 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => handleFileClick(file)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {getFormatBadge(file.format)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(file.lastModified, { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFileToRename(file)
                              setNewFileName(file.name)
                              setRenameDialogOpen(true)
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              emitFileDeleted(file.id)
                              deleteFile(file.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Delete All Button */}
              {files.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setDeleteAllDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Files
                </Button>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Configure LLM Provider Button */}
          <div className="p-4 border-t border-border">
            <Button
              className="w-full bg-primary text-primary-foreground"
              size="sm"
              onClick={() => setProviderDialogOpen(true)}
              variant={hasConfiguredProviders ? "default" : "default"}
            >
              {hasConfiguredProviders ? "Edit LLM Providers" : "Configure LLM Providers"}
            </Button>
          </div>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Files</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {fileCount} files? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // Emit event before clearing all files
                const event = new CustomEvent('allFilesDeleted')
                window.dispatchEvent(event)
                clearAllFiles()
                setDeleteAllDialogOpen(false)
              }}
            >
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for the file
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new file name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false)
                setFileToRename(null)
                setNewFileName("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Configuration Dialog */}
      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="sm:max-w-none w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Configure LLM Providers</DialogTitle>
            <DialogDescription>
            Decide which vendors power data augmentation, evaluation and visualization workflows across your agent datasets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <AIProviderConfigDemo className="h-full" />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setProviderDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
