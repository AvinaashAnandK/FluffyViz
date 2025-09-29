'use client';

import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Upload as UploadIcon, FileText, AlertCircle, CheckCircle, Database, Sparkles, X } from 'lucide-react';
import Papa from 'papaparse';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { FormatDetector } from '@/lib/format-detector';
import { DataProcessor } from '@/lib/data-processor';
import { cn } from '@/lib/utils';
import {
  SupportedFormat,
  FormatDetectionResult,
  FieldMapping,
  UploadResult,
} from '@/types';
import { useFileStorage } from '@/hooks/use-file-storage';
import { FileSelectionContext, FileSelectionSource } from '@/types/file-storage';

interface FileSelectionOptions extends Partial<FileSelectionContext> {
  skipInitialSave?: boolean;
}

export interface EnhancedUploadHandle {
  loadFile: (file: File, options?: FileSelectionOptions) => Promise<void>;
  clear: () => void;
}

interface UploadProps {
  onDataUploaded: (result: UploadResult) => void;
  onFormatDetected: (result: FormatDetectionResult) => void;
  onFileSelected?: (file: File, context?: FileSelectionContext) => void;
  initialDetectionResult?: FormatDetectionResult | null;
  initialPreviewData?: any[];
}

export const EnhancedUpload = forwardRef<EnhancedUploadHandle, UploadProps>(({
  onDataUploaded,
  onFormatDetected,
  onFileSelected,
  initialDetectionResult,
  initialPreviewData
}, ref) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectionResult, setDetectionResult] = useState<FormatDetectionResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SupportedFormat | ''>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedFileId, setSavedFileId] = useState<string | null>(null);
  const { saveFile } = useFileStorage();

  // Initialize with provided data when props change
  useEffect(() => {
    if (initialDetectionResult) {
      setDetectionResult(initialDetectionResult);
      setSelectedFormat(initialDetectionResult.detectedFormat || '');
    } else {
      setDetectionResult(null);
      setSelectedFormat('');
    }

    if (initialPreviewData) {
      setPreviewData(initialPreviewData);
    } else {
      setPreviewData([]);
    }
  }, [initialDetectionResult, initialPreviewData]);

  const readFileContent = useCallback((file: File, maxLines?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let content = e.target?.result as string;
        if (maxLines) {
          const lines = content.split('\n').slice(0, maxLines);
          content = lines.join('\n');
        }
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  const generatePreview = useCallback(async (file: File, format: SupportedFormat | null) => {
    if (!format) {
      setPreviewData([]);
      return;
    }

    switch (format) {
      case 'message-centric':
      case 'langfuse':
      case 'langsmith':
      case 'arize':
        // For JSON formats, try full content first for single JSON object detection
        const fullContent = await readFileContent(file); // Read full content
        try {
          const singleJson = JSON.parse(fullContent);
          if (Array.isArray(singleJson)) {
            setPreviewData(singleJson.slice(0, 5));
          } else {
            setPreviewData([singleJson]);
          }
        } catch {
          // If not single JSON, try JSONL format with limited lines
          const limitedContent = await readFileContent(file, 10);
          const lines = limitedContent.split('\n').filter(line => line.trim()).slice(0, 5);
          const jsonPreview = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { error: 'Invalid JSON', line };
            }
          });
          setPreviewData(jsonPreview);
        }
        break;

      case 'turn-level':
        const csvContent = await readFileContent(file, 10);
        Papa.parse(csvContent, {
          header: true,
          preview: 5,
          complete: (results) => {
            setPreviewData(results.data);
          }
        });
        break;

      default:
        setPreviewData([]);
        break;
    }
  }, [readFileContent]);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size (max 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      return 'File size must be less than 25MB';
    }

    // Check file type
    const allowedTypes = ['.csv', '.json', '.jsonl', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      return 'File type not supported. Please upload CSV, JSON, JSONL, or TXT files only.';
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(async (selectedFile: File, options: FileSelectionOptions = {}) => {
    const {
      skipInitialSave = false,
      source: providedSource,
      storedFileId
    } = options;

    const resolvedSource: FileSelectionSource = providedSource ?? 'main-upload';

    setError(null);

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setProcessing(true);
    setProgress(0);
    setProgress(20);
    setSavedFileId(storedFileId ?? null);

    onFileSelected?.(selectedFile, { source: resolvedSource, storedFileId });

    setPreviewData([]);
    setDetectionResult(null);
    setSelectedFormat('');
    setFieldMappings([]);

    try {
      const result = await FormatDetector.detectFormat(selectedFile);
      setDetectionResult(result);
      setSelectedFormat(result.detectedFormat || '');
      onFormatDetected(result);
      setProgress(60);

      await generatePreview(selectedFile, result.detectedFormat);
      setProgress(80);

      if (!skipInitialSave && result.detectedFormat && result.errors.length === 0) {
        const fileContent = await readFileContent(selectedFile);
        const persistedId = await saveFile(
          fileContent,
          selectedFile.name,
          result.detectedFormat,
          selectedFile.type,
          storedFileId
        );
        setSavedFileId(persistedId);
        setProgress(90);
      }

      setProgress(100);
    } catch (error) {
      console.error('Error processing file:', error);
      setError('Error processing file. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [validateFile, onFileSelected, onFormatDetected, generatePreview, readFileContent, saveFile]);

  const removeFile = useCallback(() => {
    setFile(null);
    setProcessing(false);
    setProgress(0);
    setError(null);
    // Clear all detection results and preview data when file is dismissed
    setPreviewData([]);
    setDetectionResult(null);
    setSelectedFormat('');
    setFieldMappings([]);
    setSavedFileId(null);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0], { source: 'main-upload' });
    }
  }, [handleFileSelect]);


  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0], { source: 'main-upload' });
    }
  };

  const processData = async () => {
    if (!file || !selectedFormat) return;

    setProcessing(true);
    setProgress(0);

    try {
      setProgress(20);

      const fileContent = await readFileContent(file);
      const persistedId = await saveFile(
        fileContent,
        file.name,
        selectedFormat,
        file.type,
        savedFileId ?? undefined
      );
      setSavedFileId(persistedId);

      setProgress(40);

      // Process the file using the DataProcessor
      const result = await DataProcessor.processFile(file, selectedFormat, fieldMappings);

      setProgress(80);

      // Pass the full result including validation errors and stats
      onDataUploaded(result);

      setProgress(100);
    } catch (error) {
      console.error('Error processing data:', error);
      setError('Error processing file. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    loadFile: (externalFile: File, options?: FileSelectionOptions) =>
      handleFileSelect(externalFile, options),
    clear: () => removeFile()
  }), [handleFileSelect, removeFile]);

  return (
    <div className="space-y-6">
      {/* Upload Card - Consolidated Header and Content */}
      <div className="rounded-2xl shadow-sm text-center">
        {/* Title and Subtitle */}
        {/* Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl py-6 px-6 text-center transition-all duration-200 cursor-pointer focus:outline-none",
            file
              ? 'border-green-400 bg-green-50'
              : dragActive
              ? 'border-primary bg-primary/10'
              : 'border-neutral-300 hover:border-primary hover:bg-primary/5'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            setError(null);
            document.getElementById('file-upload')?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setError(null);
              document.getElementById('file-upload')?.click();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Upload file area"
        >
          {file ? (
            /* Success State */
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500 ring-2 ring-green-500/20">
                <CheckCircle className="h-6 w-6" />
                <span className="sr-only">Upload complete</span>
              </div>

              <h2 className="mt-4 text-lg font-semibold tracking-tight">File ready for processing</h2>

              <Card className="mt-6 w-full max-w-md border border-green-500/20 bg-green-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-500/15 text-green-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.size < 1024
                          ? `${file.size} B`
                          : file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    aria-label="Remove file"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            </div>
          ) : (
            /* Idle State */
            <div className="space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4">
                <UploadIcon className="h-6 w-6 text-neutral-400" />
              </div>
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-neutral-800">Analyze, enrich, expand your data</h4>
              </div>
              <div className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded-lg font-medium transition-colors">
                <UploadIcon className="h-4 w-4 mr-4" />
                Drop or click to import a file
              </div>
              <p className="text-sm text-neutral-500">Supports CSV, JSON, and JSONL files</p>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            accept=".csv,.json,.jsonl,.txt"
            onChange={handleFileInputChange}
            className="hidden"
            id="file-upload"
            aria-describedby="file-upload-description"
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Processing State */}
        {processing && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">Processing file...</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {progress}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* File Upload Description for Screen Readers */}
        <div id="file-upload-description" className="sr-only">
          Upload area for CSV, JSON, JSONL, and TXT files. Maximum file size is 25MB.
        </div>
      </div>

      {detectionResult && (
        <Card className="border-l-4 border-l-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                detectionResult.detectedFormat ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
              )}>
                {detectionResult.detectedFormat ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <span>Format Detection</span>
                {detectionResult.detectedFormat && (
                  <Badge variant="secondary" className="ml-2">
                    Confidence: {Math.round(detectionResult.confidence * 100)}%
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Automatic detection results and manual override options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {detectionResult.detectedFormat && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">Detected Format</span>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {detectionResult.detectedFormat.replace('-', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-semibold">Format Override</label>
              <Select
                value={selectedFormat}
                onValueChange={async (value) => {
                  const newFormat = value as SupportedFormat;
                  setSelectedFormat(newFormat);
                  // Regenerate preview and validation with new format
                  if (file && detectionResult) {
                    await generatePreview(file, newFormat);
                    // Update detection result with new validation
                    const fileContent = await readFileContent(file);
                    const newErrors = FormatDetector.validateFormat(fileContent, newFormat);
                    setDetectionResult({
                      ...detectionResult,
                      detectedFormat: newFormat,
                      confidence: 1.0, // Manual override means 100% confidence
                      errors: newErrors
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a different format if needed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message-centric">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Message-centric JSONL</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="langfuse">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4" />
                      <span>Langfuse Traces</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="langsmith">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4" />
                      <span>LangSmith Runs</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="arize">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4" />
                      <span>Arize Traces</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="turn-level">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Turn-level CSV</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {detectionResult.suggestions.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Suggestions</span>
                </div>
                <ul className="space-y-2">
                  {detectionResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-blue-800">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detectionResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-900">Issues Found</span>
                </div>
                <ul className="space-y-2">
                  {detectionResult.errors.map((error, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {previewData.length > 0 && (
        <Card className="border-l-4 border-l-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span>Data Preview</span>
                <Badge variant="outline" className="ml-2">
                  {previewData.length} rows
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Sample of your uploaded data structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 border rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Sample Data</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-96">
                <pre className="text-xs p-4 text-slate-800 leading-relaxed">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {file && selectedFormat && detectionResult?.errors.length === 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/20 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Ready to Process</h3>
              <p className="text-sm text-muted-foreground">
                Your file is validated and ready for data transformation
              </p>
            </div>
            <Button
              onClick={processData}
              disabled={processing}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              {processing ? (
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Process Data</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

EnhancedUpload.displayName = 'EnhancedUpload';
