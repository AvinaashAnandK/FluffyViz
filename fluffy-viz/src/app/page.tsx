import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="px-8 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-6xl font-bold text-primary">FluffyViz</h1>
          <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
            Transform AI agent output data into actionable insights through iterative augmentation and visualization
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/style-guide">View Style Guide</Link>
            </Button>
            <Button variant="outline" size="lg">
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="px-8 py-16 bg-muted/30">
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

      {/* CTA Section */}
      <section className="px-8 py-20 bg-primary text-primary-foreground text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold">Ready to visualize your AI data?</h2>
          <p className="text-xl opacity-90">
            Start transforming your unstructured conversations into actionable insights today
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary">
              Request Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
