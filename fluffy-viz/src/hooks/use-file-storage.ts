"use client"

import { useState, useEffect, useCallback } from 'react'
import { StoredFile } from '@/components/app-sidebar'

const STORAGE_KEY = 'fluffy-viz-stored-files'

export function useFileStorage() {
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  // Load files from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const files: StoredFile[] = JSON.parse(stored).map((file: any) => ({
          ...file,
          uploadedAt: new Date(file.uploadedAt)
        }))
        setStoredFiles(files)

        // Set the most recent file as active if no active file is set
        if (files.length > 0) {
          setActiveFileId(files[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading stored files:', error)
    }
  }, [])

  // Save files to localStorage whenever storedFiles changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedFiles))
    } catch (error) {
      console.error('Error saving files to storage:', error)
    }
  }, [storedFiles])

  const addFile = useCallback((
    file: File,
    detectionResult?: any,
    previewData?: any[],
    selectedFormat?: string
  ) => {
    const newStoredFile: StoredFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      detectionResult,
      previewData,
      selectedFormat
    }

    setStoredFiles(prev => [newStoredFile, ...prev])
    setActiveFileId(newStoredFile.id)

    return newStoredFile.id
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setStoredFiles(prev => prev.filter(f => f.id !== fileId))

    // If the active file was deleted, set the next available file as active
    if (activeFileId === fileId) {
      setStoredFiles(current => {
        const remainingFiles = current.filter(f => f.id !== fileId)
        if (remainingFiles.length > 0) {
          setActiveFileId(remainingFiles[0].id)
        } else {
          setActiveFileId(null)
        }
        return remainingFiles
      })
    }
  }, [activeFileId])

  const getActiveFile = useCallback(() => {
    return storedFiles.find(f => f.id === activeFileId) || null
  }, [storedFiles, activeFileId])

  const selectFile = useCallback((fileId: string) => {
    setActiveFileId(fileId)
  }, [])

  const updateFileData = useCallback((
    fileId: string,
    updates: Partial<Pick<StoredFile, 'detectionResult' | 'previewData' | 'selectedFormat'>>
  ) => {
    setStoredFiles(prev =>
      prev.map(file =>
        file.id === fileId
          ? { ...file, ...updates }
          : file
      )
    )
  }, [])

  const renameFile = useCallback((fileId: string, newName: string) => {
    setStoredFiles(prev =>
      prev.map(file =>
        file.id === fileId
          ? { ...file, name: newName }
          : file
      )
    )
  }, [])

  const clearAllFiles = useCallback(() => {
    setStoredFiles([])
    setActiveFileId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    storedFiles,
    activeFileId,
    activeFile: getActiveFile(),
    addFile,
    removeFile,
    selectFile,
    updateFileData,
    renameFile,
    clearAllFiles
  }
}