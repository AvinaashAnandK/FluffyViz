"use client"

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedUpload } from "@/components/enhanced-upload";
import { Github } from "lucide-react";
import { FormatDetectionResult, UploadResult } from "@/types";

export default function Home() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [detectionResult, setDetectionResult] = useState<FormatDetectionResult | null>(null);

  const handleDataUploaded = (result: UploadResult) => {
    setUploadResult(result);
    console.log('Data processed:', result);
    // TODO: Navigate to next step or show results
  };

  const handleFormatDetected = (result: FormatDetectionResult) => {
    setDetectionResult(result);
    console.log('Format detected:', result);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="px-8 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-center space-x-4">
            <img
              src="/FluffyVisualizer.png"
              alt="FluffyViz Logo"
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-6xl font-bold text-primary">FluffyViz</h1>
          </div>
          <p className="text-2xl text-muted-foreground max-w-4xl mx-auto">
            Transform AI agent output data into actionable insights through iterative augmentation and visualization
          </p>
        </div>
      </section>

      {/* Upload Section */}
      <section id="upload-section" className="px-8 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Get Started with Your Data</h2>
            <p className="text-xl text-muted-foreground">
              Upload your conversational data and begin the FluffyViz workflow
            </p>
          </div>
          <EnhancedUpload
            onDataUploaded={handleDataUploaded}
            onFormatDetected={handleFormatDetected}
          />
        </div>
      </section>

      {/* Upload Results Section */}
      {uploadResult && (
        <section className="px-8 py-16">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Upload Results</CardTitle>
                <CardDescription>
                  Your data has been processed successfully
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{uploadResult.stats.total_rows}</div>
                    <div className="text-sm text-muted-foreground">Total Rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{uploadResult.stats.valid_rows}</div>
                    <div className="text-sm text-muted-foreground">Valid Rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{uploadResult.stats.invalid_rows}</div>
                    <div className="text-sm text-muted-foreground">Invalid Rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{uploadResult.stats.duplicate_ids}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </div>
                </div>
                {uploadResult.validation_errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Validation Errors:</h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {uploadResult.validation_errors.slice(0, 5).map((error, index) => (
                        <div key={index} className="text-sm text-red-800">
                          Row {error.row_index}: {error.message}
                        </div>
                      ))}
                      {uploadResult.validation_errors.length > 5 && (
                        <div className="text-sm text-red-600 mt-1">
                          ... and {uploadResult.validation_errors.length - 5} more errors
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Workflow Section */}
      <section className="px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Simple 4-Step Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-2xl font-bold">1</div>
                <CardTitle>Upload</CardTitle>
                <CardDescription>Raw conversational/agent output data (CSV, JSON, etc.)</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-2xl font-bold">2</div>
                <CardTitle>Augment</CardTitle>
                <CardDescription>Select from library of enrichment functions + upload custom ones</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-2xl font-bold">3</div>
                <CardTitle>Process</CardTitle>
                <CardDescription>Batch apply augmentations to add analytical columns</CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-2xl font-bold">4</div>
                <CardTitle>Visualize</CardTitle>
                <CardDescription>Export enriched dataset directly to Embedding Atlas</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Target Users */}
      <section className="px-8 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">Built for AI Teams</h2>
          <p className="text-xl text-muted-foreground">
            Designed specifically for ML Engineers & AI Product Managers who need to understand agent or GenAI features performance patterns
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <Card>
              <CardHeader>
                <CardTitle>ML Engineers</CardTitle>
                <CardDescription>
                  Transform raw agent logs into structured data for model performance analysis and improvement
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>AI Product Managers</CardTitle>
                <CardDescription>
                  Gain insights into user interactions and feature performance to drive product decisions
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Credits Section */}
      <section className="px-8 py-20 bg-primary text-primary-foreground text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold">Built with Open Source</h2>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="https://github.com/huggingface/aisheets" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-5 w-5" />
                HuggingFace AISheets
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="https://github.com/apple/embedding-atlas" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-5 w-5" />
                Apple Embedding Atlas
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
