"use client"

import React from "react"
import { File, Upload, ChevronRight, Trash2, FileText, Database, Code2, Edit2 } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Types for stored file data
export interface StoredFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  detectionResult?: any
  previewData?: any[]
  selectedFormat?: string
}

interface AppSidebarProps {
  storedFiles: StoredFile[]
  activeFileId: string | null
  onFileSelect: (fileId: string) => void
  onFileDelete: (fileId: string) => void
  onFileRename: (fileId: string, newName: string) => void
  onUploadNew: () => void
}

export function AppSidebar({
  storedFiles,
  activeFileId,
  onFileSelect,
  onFileDelete,
  onFileRename,
  onUploadNew
}: AppSidebarProps) {
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'csv':
        return <Database className="h-4 w-4 text-green-600" />
      case 'json':
      case 'jsonl':
        return <Code2 className="h-4 w-4 text-blue-600" />
      case 'txt':
        return <FileText className="h-4 w-4 text-gray-600" />
      default:
        return <File className="h-4 w-4 text-gray-600" />
    }
  }

  const formatFileSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  return (
    <Sidebar
      side="left"
      className="border-r"
      style={{ backgroundColor: '#D1CCDC' }}
    >
      <SidebarHeader className="px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Agent Datasets</h2>
            <p className="text-sm text-gray-600">
              {storedFiles.length} {storedFiles.length === 1 ? 'file' : 'files'} uploaded
            </p>
          </div>
        </div>
        <Button
          onClick={onUploadNew}
          className="w-full mt-4 bg-primary hover:bg-primary/90"
          size="sm"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload New File
        </Button>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <SidebarGroup className="flex-1 min-h-0">
          <SidebarGroupLabel>Uploaded Files</SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 min-h-0">
            {storedFiles.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No files uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload a file to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex-1 overflow-y-auto min-h-0">
                  <SidebarMenu>
                    {storedFiles.map((file) => (
                      <SidebarMenuItem key={file.id}>
                        <SidebarMenuButton
                          onClick={() => onFileSelect(file.id)}
                          isActive={activeFileId === file.id}
                          className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-white/50 transition-colors"
                        >
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 mt-0.5">
                              {getFileIcon(file.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {file.name}
                                </p>
                                {activeFileId === file.id && (
                                  <Badge variant="secondary" className="text-xs">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {formatFileSize(file.size)}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {formatDate(file.uploadedAt)}
                                </span>
                              </div>
                              {file.selectedFormat && (
                                <Badge variant="default" className="text-xs mt-1 bg-blue-100 text-blue-800">
                                  {file.selectedFormat.replace('-', ' ').toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </SidebarMenuButton>
                        <div className="flex space-x-1">
                          <SidebarMenuAction
                            onClick={(e) => {
                              e.stopPropagation()
                              const newName = prompt("Enter new file name:", file.name)
                              if (newName && newName !== file.name) {
                                onFileRename(file.id, newName)
                              }
                            }}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                          >
                            <Edit2 className="h-3 w-3" />
                          </SidebarMenuAction>
                          <SidebarMenuAction
                            onClick={(e) => {
                              e.stopPropagation()
                              onFileDelete(file.id)
                            }}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </SidebarMenuAction>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Delete All Files Button */}
      {storedFiles.length > 0 && (
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Delete all ${storedFiles.length} files? This action cannot be undone.`)) {
                storedFiles.forEach(file => onFileDelete(file.id))
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All Files
          </Button>
        </div>
      )}

      {/* Configure LLM Provider Button at Bottom */}
      <div className="p-4 border-t border-border">
        <Button
          disabled
          className="w-full bg-primary text-primary-foreground opacity-50 cursor-not-allowed"
          size="sm"
        >
          Configure LLM Provider
        </Button>
      </div>

      <SidebarRail />
    </Sidebar>
  )
}