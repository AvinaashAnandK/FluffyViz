"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Upload, File, Search, X, FileText, Database, Code2 } from "lucide-react"

interface FileUploadProps {
  className?: string
  onFileSelect?: (file: File) => void
  onDescriptionChange?: (description: string) => void
}

export function FileUploadArea({ className, onFileSelect, onDescriptionChange }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setSelectedFile(file)
      onFileSelect?.(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      onFileSelect?.(file)
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    onDescriptionChange?.(value)
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'csv':
        return <Database className="h-5 w-5 text-green-600" />
      case 'json':
      case 'jsonl':
        return <Code2 className="h-5 w-5 text-blue-600" />
      case 'txt':
        return <FileText className="h-5 w-5 text-gray-600" />
      default:
        return <File className="h-5 w-5 text-gray-600" />
    }
  }

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Main Upload Area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : selectedFile
              ? "border-green-300 bg-green-50 dark:bg-green-950/20"
              : "border-muted-foreground/25 hover:border-muted-foreground/40"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.jsonl,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              {getFileIcon(selectedFile.name)}
              <span className="font-medium">{selectedFile.name}</span>
              <Badge variant="secondary">{(selectedFile.size / 1024).toFixed(1)} KB</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              File ready for upload. Add a description below or upload directly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Analyze, enrich, expand your data</h3>
              <p className="text-muted-foreground">Upload your conversational data to get started</p>
            </div>
            <Button onClick={openFileDialog} className="mt-4">
              <Upload className="mr-2 h-4 w-4" />
              Drop or click to import a file
            </Button>
            <p className="text-xs text-muted-foreground">
              Supports CSV, JSON, JSONL, and TXT files
            </p>
          </div>
        )}
      </div>

    </div>
  )
}

// Compact version for smaller spaces
export function CompactFileUpload({ className, onFileSelect }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      onFileSelect?.(file)
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.jsonl,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onClick={openFileDialog}
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/40 cursor-pointer transition-colors"
      >
        {selectedFile ? (
          <div className="space-y-2">
            <File className="h-6 w-6 mx-auto text-green-600" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">Ready to upload</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="font-medium">Drop files here</p>
            <p className="text-xs text-muted-foreground">CSV, JSON, JSONL, TXT</p>
          </div>
        )}
      </div>
    </div>
  )
}