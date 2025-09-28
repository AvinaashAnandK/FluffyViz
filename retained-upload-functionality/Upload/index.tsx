'use client';

import React, { useState, useCallback } from 'react';
import { Upload as UploadIcon, FileText, AlertCircle, CheckCircle, CloudUpload, File, Database, Sparkles } from 'lucide-react';
import Papa from 'papaparse';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { FormatDetector } from './FormatDetector';
import { DataProcessor } from '@/lib/data-processor';
import {
  SupportedFormat,
  FormatDetectionResult,
  NormalizedAgentData,
  FieldMapping,
  UploadResult,
} from '@/types';

interface UploadProps {
  onDataUploaded: (result: UploadResult) => void;
  onFormatDetected: (result: FormatDetectionResult) => void;
}

export function Upload({ onDataUploaded, onFormatDetected }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectionResult, setDetectionResult] = useState<FormatDetectionResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SupportedFormat | ''>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

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

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setProcessing(true);
    setProgress(20);

    // Reset preview data and detection results
    setPreviewData([]);
    setDetectionResult(null);
    setSelectedFormat('');

    try {
      // Detect format
      const result = await FormatDetector.detectFormat(selectedFile);
      setDetectionResult(result);
      setSelectedFormat(result.detectedFormat || '');
      onFormatDetected(result);
      setProgress(60);

      // Generate preview
      await generatePreview(selectedFile, result.detectedFormat);
      setProgress(100);
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setProcessing(false);
    }
  }, [onFormatDetected, generatePreview]);

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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);


  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const processData = async () => {
    if (!file || !selectedFormat) return;

    setProcessing(true);
    setProgress(0);

    try {
      setProgress(20);

      // Process the file using the DataProcessor
      const result = await DataProcessor.processFile(file, selectedFormat, fieldMappings);

      setProgress(80);

      // Pass the full result including validation errors and stats
      onDataUploaded(result);

      setProgress(100);
    } catch (error) {
      console.error('Error processing data:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <CloudUpload className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">Upload Agent Data</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transform your agent conversation data into actionable insights. Upload CSV, JSON, or JSONL files to get started.
        </p>

        {/* Supported Formats */}
        <div className="flex items-center justify-center space-x-2">
          <span className="text-sm text-muted-foreground">Supported formats:</span>
          <Badge variant="outline" className="text-xs">CSV</Badge>
          <Badge variant="outline" className="text-xs">JSON</Badge>
          <Badge variant="outline" className="text-xs">JSONL</Badge>
        </div>
      </div>

      <Separator />

      {/* Upload Card */}
      <Card className="border-2 hover:border-primary/20 transition-colors">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center space-x-2">
            <Database className="h-5 w-5 text-primary" />
            <span>Data Upload</span>
          </CardTitle>
          <CardDescription>
            Drag & drop your file or click to browse from your computer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
              dragActive
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-lg'
                : file
                ? 'border-green-300 bg-green-50/50'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-6">
              {/* Icon */}
              <div className="relative">
                {file ? (
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <File className="h-16 w-16 text-green-500 mx-auto" />
                      <CheckCircle className="h-6 w-6 text-green-500 absolute -top-1 -right-1 bg-background rounded-full" />
                    </div>
                  </div>
                ) : (
                  <CloudUpload className={`h-16 w-16 mx-auto transition-colors ${
                    dragActive ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                <p className="text-xl font-semibold">
                  {file ? (
                    <span className="text-green-700 flex items-center justify-center space-x-2">
                      <span>{file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                    </span>
                  ) : (
                    'Drop your file here or click to browse'
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {file ? 'File ready for processing' : 'Maximum file size: 10MB'}
                </p>
              </div>

              {/* Action Button */}
              <input
                type="file"
                accept=".csv,.json,.jsonl"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
              />
              <Button
                asChild
                size="lg"
                className={`mt-6 ${file ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                <label htmlFor="file-upload" className="cursor-pointer">
                  {file ? 'Change File' : 'Browse Files'}
                </label>
              </Button>
            </div>
          </div>

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
        </CardContent>
      </Card>

      {detectionResult && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                detectionResult.detectedFormat ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
              }`}>
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
        <Card className="border-l-4 border-l-blue-500">
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
}