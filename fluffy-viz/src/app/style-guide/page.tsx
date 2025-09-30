"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { WorkflowBreadcrumb, CompactWorkflowBreadcrumb, VerticalWorkflowBreadcrumb } from "@/components/workflow-breadcrumb"
import { EnhancedUpload } from "@/components/enhanced-upload"
import { AIProviderConfigDemo } from "@/components/ai-provider-config-demo"
import {
  BarChart3,
  Database,
  Users,
  FileBarChart,
  Brain
} from "lucide-react"

export default function StyleGuide() {
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // Workflow steps for FluffyViz
  const workflowSteps = [
    {
      id: "upload",
      title: "Upload",
      description: "Raw conversational/agent output data",
      status: "completed" as const
    },
    {
      id: "augment",
      title: "Augment",
      description: "Select enrichment functions",
      status: "completed" as const
    },
    {
      id: "process",
      title: "Process",
      description: "Batch apply augmentations",
      status: "current" as const
    },
    {
      id: "visualize",
      title: "Visualize",
      description: "Export to Embedding Atlas",
      status: "pending" as const
    }
  ]

  const sampleData = [
    {
      id: "001",
      title: "Customer Support Analysis",
      category: "Support",
      status: "Processing",
      progress: 75,
      assignee: "Sarah Chen",
      avatar: "SC"
    },
    {
      id: "002",
      title: "Product Feedback Classification",
      category: "Product",
      status: "Complete",
      progress: 100,
      assignee: "Alex Rodriguez",
      avatar: "AR"
    },
    {
      id: "003",
      title: "Sales Conversation Insights",
      category: "Sales",
      status: "In Review",
      progress: 90,
      assignee: "Jamie Kim",
      avatar: "JK"
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Complete": return "bg-green-100 text-green-800"
      case "Processing": return "bg-blue-100 text-blue-800"
      case "In Review": return "bg-yellow-100 text-yellow-800"
      case "Pending": return "bg-gray-100 text-gray-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Support": return "bg-purple-100 text-purple-800"
      case "Product": return "bg-green-100 text-green-800"
      case "Sales": return "bg-blue-100 text-blue-800"
      case "Technical": return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-background p-8" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          <h1 className="text-4xl font-bold text-primary">FluffyViz Style Guide</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Design system for AI agent output data visualization and analysis platform
          </p>
        </div>

        {/* Brand Colors */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Brand Colors</h2>

          {/* Light Mode Colors */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Light Mode Palette</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 bg-primary rounded-md mb-4"></div>
                  <h4 className="font-semibold">Primary</h4>
                  <p className="text-xs text-muted-foreground">#454372</p>
                  <p className="text-sm text-muted-foreground">Data insights & CTAs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 bg-secondary rounded-md mb-4"></div>
                  <h4 className="font-semibold">Secondary</h4>
                  <p className="text-xs text-muted-foreground">Light blue-gray</p>
                  <p className="text-sm text-muted-foreground">Supporting elements</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 bg-muted rounded-md mb-4"></div>
                  <h4 className="font-semibold">Muted</h4>
                  <p className="text-xs text-muted-foreground">Neutral gray</p>
                  <p className="text-sm text-muted-foreground">Background areas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 bg-accent rounded-md mb-4"></div>
                  <h4 className="font-semibold">Accent</h4>
                  <p className="text-xs text-muted-foreground">Light gray</p>
                  <p className="text-sm text-muted-foreground">Highlights & features</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Dark Mode Colors */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Dark Mode Palette</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 rounded-md mb-4" style={{backgroundColor: '#7c7aad'}}></div>
                  <h4 className="font-semibold">Primary</h4>
                  <p className="text-xs text-muted-foreground">#7c7aad</p>
                  <p className="text-sm text-muted-foreground">Lighter purple for dark backgrounds</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 rounded-md mb-4" style={{backgroundColor: 'oklch(0.2941 0.0196 264.5419)'}}></div>
                  <h4 className="font-semibold">Secondary</h4>
                  <p className="text-xs text-muted-foreground">Dark blue-gray</p>
                  <p className="text-sm text-muted-foreground">Subtle backgrounds</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 rounded-md mb-4" style={{backgroundColor: 'oklch(0.2520 0 0)'}}></div>
                  <h4 className="font-semibold">Muted</h4>
                  <p className="text-xs text-muted-foreground">Dark gray</p>
                  <p className="text-sm text-muted-foreground">Card backgrounds</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="w-full h-20 rounded-md mb-4" style={{backgroundColor: 'oklch(0.3211 0 0)'}}></div>
                  <h4 className="font-semibold">Accent</h4>
                  <p className="text-xs text-muted-foreground">Medium gray</p>
                  <p className="text-sm text-muted-foreground">Interactive elements</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Theme Toggle Demo */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Theme Toggle</h3>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold mb-2">Dark Mode Toggle</h4>
                    <p className="text-sm text-muted-foreground">Toggle between light and dark themes using the button in the top-right corner</p>
                  </div>
                  <ThemeToggle />
                </div>
                <div className="mt-4 p-4 border rounded-lg">
                  <p className="text-sm">
                    Current theme colors automatically adapt based on user preference or manual selection.
                    The toggle persists the user&apos;s choice in localStorage.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Typography - Open Sans</h2>
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold">Heading 1 - Main page titles</h1>
              <p className="text-sm text-muted-foreground">text-4xl font-bold</p>
            </div>
            <div>
              <h2 className="text-3xl font-semibold">Heading 2 - Section headers</h2>
              <p className="text-sm text-muted-foreground">text-3xl font-semibold</p>
            </div>
            <div>
              <h3 className="text-2xl font-medium">Heading 3 - Subsections</h3>
              <p className="text-sm text-muted-foreground">text-2xl font-medium</p>
            </div>
            <div>
              <p className="text-base">Body text for descriptions and content</p>
              <p className="text-sm text-muted-foreground">text-base</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Small text for metadata and hints</p>
              <p className="text-xs text-muted-foreground">text-sm text-muted-foreground</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button>Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        {/* Form Elements */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Form Elements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Upload Form</CardTitle>
                <CardDescription>Example form for the upload workflow step</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dataset-name">Dataset Name</Label>
                  <Input id="dataset-name" placeholder="My agent conversations..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Describe your dataset..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Data Format</Label>
                  <Select>
                    <SelectTrigger id="format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="jsonl">JSONL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">Upload Dataset</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Status</CardTitle>
                <CardDescription>Real-time feedback during augmentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Data validation</span>
                    <span>100%</span>
                  </div>
                  <Progress value={100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sentiment analysis</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Topic extraction</span>
                    <span>45%</span>
                  </div>
                  <Progress value={45} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* AI Provider Configuration */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold">AI Provider Configuration</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Interactive walkthrough for managing API keys, feature flags, and supported capabilities across the vendors that power FluffyViz enrichment.
            </p>
          </div>
          <AIProviderConfigDemo />
        </section>

        {/* Data Tables */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Data Display</h2>
          <Card>
            <CardHeader>
              <CardTitle>Sample Dataset View</CardTitle>
              <CardDescription>How enriched data appears before visualization</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Original Text</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">001</TableCell>
                    <TableCell className="max-w-xs truncate">The agent provided helpful guidance...</TableCell>
                    <TableCell><span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Positive</span></TableCell>
                    <TableCell>Customer Support</TableCell>
                    <TableCell>0.89</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">002</TableCell>
                    <TableCell className="max-w-xs truncate">The response was unclear and confusing...</TableCell>
                    <TableCell><span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Negative</span></TableCell>
                    <TableCell>Technical Issues</TableCell>
                    <TableCell>0.92</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">003</TableCell>
                    <TableCell className="max-w-xs truncate">Standard interaction, nothing notable...</TableCell>
                    <TableCell><span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">Neutral</span></TableCell>
                    <TableCell>General</TableCell>
                    <TableCell>0.67</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Workflow Visualization */}
        <section className="space-y-8">
          <h2 className="text-3xl font-semibold">Workflow Visualization</h2>

          {/* Traditional Workflow Cards */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Workflow Cards</h3>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-primary border-2">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
                      <h4 className="font-semibold text-lg mb-2">Upload</h4>
                      <p className="text-sm text-muted-foreground">Raw conversational data</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-muted text-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
                      <h4 className="font-semibold text-lg mb-2">Augment</h4>
                      <p className="text-sm text-muted-foreground">Select enrichment functions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-muted text-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
                      <h4 className="font-semibold text-lg mb-2">Process</h4>
                      <p className="text-sm text-muted-foreground">Batch apply augmentations</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-muted text-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">4</div>
                      <h4 className="font-semibold text-lg mb-2">Visualize</h4>
                      <p className="text-sm text-muted-foreground">Export to Embedding Atlas</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Breadcrumbs */}
          <div className="space-y-6">
            <h3 className="text-xl font-medium">Breadcrumb Navigation</h3>

            {/* Standard Breadcrumb */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium">Standard Breadcrumb</h4>
              <Card>
                <CardContent className="p-6">
                  <WorkflowBreadcrumb steps={workflowSteps} />
                </CardContent>
              </Card>
            </div>

            {/* Compact Breadcrumb */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium">Compact Horizontal</h4>
              <Card>
                <CardContent className="p-6">
                  <CompactWorkflowBreadcrumb steps={workflowSteps} />
                </CardContent>
              </Card>
            </div>

            {/* Vertical Breadcrumb */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium">Vertical Breadcrumb</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <VerticalWorkflowBreadcrumb steps={workflowSteps} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <h5 className="font-semibold mb-4">Usage Guidelines</h5>
                    <div className="space-y-3 text-sm">
                      <div>
                        <strong>Cards:</strong> Great for landing pages and overview sections
                      </div>
                      <div>
                        <strong>Standard:</strong> Use for main workflow navigation with descriptions
                      </div>
                      <div>
                        <strong>Compact:</strong> Perfect for headers or limited space areas
                      </div>
                      <div>
                        <strong>Vertical:</strong> Ideal for sidebars or detailed step-by-step guides
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        All variants support three states: completed (✓), current (highlighted), and pending (muted)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Interactive States Demo */}
            <div className="space-y-3">
              <h4 className="text-lg font-medium">Interactive States</h4>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">All Pending</CardTitle>
                    <CardDescription>Initial state when workflow starts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CompactWorkflowBreadcrumb
                      steps={workflowSteps.map(step => ({ ...step, status: "pending" }))}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">In Progress</CardTitle>
                    <CardDescription>Mid-workflow with current step highlighted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CompactWorkflowBreadcrumb steps={workflowSteps} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">All Complete</CardTitle>
                    <CardDescription>Finished workflow with all steps done</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CompactWorkflowBreadcrumb
                      steps={workflowSteps.map(step => ({ ...step, status: "completed" }))}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* File Upload Components */}
        <section className="space-y-8">
          <h2 className="text-3xl font-semibold">File Upload & Data Input</h2>

          {/* Main Upload Area */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Primary Upload Interface</h3>
            <Card>
              <CardContent className="p-6">
                <EnhancedUpload
                  onDataUploaded={(data) => console.log('Data uploaded:', data)}
                  onFormatDetected={(format) => console.log('Format detected:', format)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Compact Upload */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Compact Upload</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <EnhancedUpload
                    onDataUploaded={(data) => console.log('Data uploaded:', data)}
                    onFormatDetected={(format) => console.log('Format detected:', format)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-4">Upload Features</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Drag & Drop:</strong> Intuitive file dropping with visual feedback
                    </div>
                    <div>
                      <strong>File Types:</strong> Supports CSV, JSON, JSONL, and TXT formats
                    </div>
                    <div>
                      <strong>Descriptions:</strong> Optional dataset descriptions for context
                    </div>
                    <div>
                      <strong>Trending Tags:</strong> Quick-select common use cases
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Inspired by AI Sheets design with FluffyViz-specific messaging
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Upload States */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Upload States</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Empty State</CardTitle>
                  <CardDescription>Initial upload area before file selection</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Drop or click to import</p>
                    <p className="text-xs text-muted-foreground">Ready for upload</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Drag Active</CardTitle>
                  <CardDescription>Visual feedback during drag operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-primary bg-primary/5 rounded-lg p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <Database className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-primary">Drop file here</p>
                    <p className="text-xs text-muted-foreground">Release to upload</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">File Selected</CardTitle>
                  <CardDescription>Confirmation state with file details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-2">
                      <Database className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-sm font-medium">conversations.csv</p>
                    <p className="text-xs text-muted-foreground">2.3 KB • Ready</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Badges & Status Indicators */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Badges & Status Indicators</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-4">Status Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800">Complete</Badge>
                <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
                <Badge className="bg-yellow-100 text-yellow-800">In Review</Badge>
                <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
                <Badge className="bg-red-100 text-red-800">Failed</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Category Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-purple-100 text-purple-800">Support</Badge>
                <Badge className="bg-green-100 text-green-800">Product</Badge>
                <Badge className="bg-blue-100 text-blue-800">Sales</Badge>
                <Badge className="bg-orange-100 text-orange-800">Technical</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Sentiment Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800">Positive</Badge>
                <Badge className="bg-red-100 text-red-800">Negative</Badge>
                <Badge className="bg-gray-100 text-gray-800">Neutral</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Statistics Cards */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Statistics Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Datasets</p>
                    <p className="text-2xl font-bold">1,125</p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex items-center text-sm text-green-600 mt-2">
                  <span>↗ 5.2%</span>
                  <span className="ml-1 text-muted-foreground">this month</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                    <p className="text-2xl font-bold">68</p>
                  </div>
                  <FileBarChart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex items-center text-sm text-green-600 mt-2">
                  <span>↗ 12.5%</span>
                  <span className="ml-1 text-muted-foreground">this month</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Processing Queue</p>
                    <p className="text-2xl font-bold">23</p>
                  </div>
                  <Brain className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex items-center text-sm text-orange-600 mt-2">
                  <span>↓ 2.1%</span>
                  <span className="ml-1 text-muted-foreground">this month</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                    <p className="text-2xl font-bold">12</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex items-center text-sm text-green-600 mt-2">
                  <span>↗ 8.3%</span>
                  <span className="ml-1 text-muted-foreground">this month</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Advanced Data Table */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Advanced Data Table</h2>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Management Table</CardTitle>
                  <CardDescription>
                    {selectedRows.length > 0
                      ? `${selectedRows.length} of ${sampleData.length} row(s) selected.`
                      : `Interactive table with selection, badges, and progress indicators`
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <select className="text-sm border rounded px-2 py-1">
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                  </select>
                  <span className="text-sm text-muted-foreground">Page 1 of 7</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled>‹</Button>
                    <Button variant="outline" size="sm">›</Button>
                    <Button variant="outline" size="sm">››</Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="rounded"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(sampleData.map(item => item.id))
                          } else {
                            setSelectedRows([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Project Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedRows.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRows([...selectedRows, item.id])
                            } else {
                              setSelectedRows(selectedRows.filter(id => id !== item.id))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">ID: {item.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getCategoryColor(item.category)}>
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <div className="flex items-center gap-2">
                            <Progress value={item.progress} className="h-2" />
                            <span className="text-sm text-muted-foreground">{item.progress}%</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{item.avatar}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{item.assignee}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">⋯</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Chart Examples */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Data Visualization</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pie Chart - Donut with Text</CardTitle>
                <CardDescription>January - June 2024</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-64 flex items-center justify-center">
                  {/* Donut Chart Visual */}
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {/* Background circle */}
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#f3f4f6" strokeWidth="10"/>
                      {/* Segments */}
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#10b981" strokeWidth="10"
                              strokeDasharray="55 100" strokeDashoffset="0"/>
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#f59e0b" strokeWidth="10"
                              strokeDasharray="25 100" strokeDashoffset="-55"/>
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#ef4444" strokeWidth="10"
                              strokeDasharray="15 100" strokeDashoffset="-80"/>
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#8b5cf6" strokeWidth="10"
                              strokeDasharray="5 100" strokeDashoffset="-95"/>
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-bold text-primary">1,125</div>
                      <div className="text-sm text-muted-foreground">Visitors</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    ↗ Trending up by 5.2% this month
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Showing total visitors for the last 6 months
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Horizontal Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Bar Chart - Mixed</CardTitle>
                <CardDescription>January - June 2024</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">Chrome</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-muted rounded-full h-6 relative">
                        <div className="bg-emerald-500 h-6 rounded-full flex items-center justify-end pr-2" style={{width: "85%"}}>
                          <span className="text-xs text-white font-medium flex items-center">
                            <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
                            Visitors 275
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">Safari</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-muted rounded-full h-6">
                        <div className="bg-red-500 h-6 rounded-full" style={{width: "65%"}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">Firefox</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-muted rounded-full h-6">
                        <div className="bg-orange-400 h-6 rounded-full" style={{width: "45%"}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">Edge</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-muted rounded-full h-6">
                        <div className="bg-purple-600 h-6 rounded-full" style={{width: "75%"}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">Other</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-muted rounded-full h-6">
                        <div className="bg-orange-300 h-6 rounded-full" style={{width: "25%"}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    ↗ Trending up by 5.2% this month
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Showing total visitors for the last 6 months
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Chart Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart Representation */}
            <Card>
              <CardHeader>
                <CardTitle>Line Chart - Trends</CardTitle>
                <CardDescription>Performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end justify-between px-4 pb-4 border-b border-l">
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "60px"}}></div>
                    <span className="text-xs text-muted-foreground">Jan</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "80px"}}></div>
                    <span className="text-xs text-muted-foreground">Feb</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "120px"}}></div>
                    <span className="text-xs text-muted-foreground">Mar</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "100px"}}></div>
                    <span className="text-xs text-muted-foreground">Apr</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "140px"}}></div>
                    <span className="text-xs text-muted-foreground">May</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-2 bg-blue-500 mb-2" style={{height: "110px"}}></div>
                    <span className="text-xs text-muted-foreground">Jun</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">Dataset processing trends</p>
                </div>
              </CardContent>
            </Card>

            {/* Metric Cards Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Metric Cards</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">94.2%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">1.2s</div>
                    <div className="text-xs text-muted-foreground">Avg Response</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">42K</div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">99.1%</div>
                    <div className="text-xs text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold">Design Guidelines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Do</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• Use consistent spacing (4, 6, 8, 12 units)</p>
                <p>• Provide clear visual feedback for processing states</p>
                <p>• Use semantic colors for data categories</p>
                <p>• Keep data tables scannable with proper typography</p>
                <p>• Show progress for long-running operations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Don&apos;t</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• Mix different button styles in the same context</p>
                <p>• Use color alone to convey important information</p>
                <p>• Overcrowd interfaces with too many options</p>
                <p>• Hide critical actions behind multiple clicks</p>
                <p>• Use jarring animations or transitions</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Google Fonts Link */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap');
      `}</style>
    </div>
  )
}
