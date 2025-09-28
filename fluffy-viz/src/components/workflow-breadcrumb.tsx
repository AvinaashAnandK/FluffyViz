"use client"

import { cn } from "@/lib/utils"
import { Check, ChevronRight } from "lucide-react"

interface WorkflowStep {
  id: string
  title: string
  description?: string
  status: "pending" | "current" | "completed"
}

interface WorkflowBreadcrumbProps {
  steps: WorkflowStep[]
  className?: string
}

export function WorkflowBreadcrumb({ steps, className }: WorkflowBreadcrumbProps) {
  return (
    <nav aria-label="Workflow progress" className={cn("w-full", className)}>
      <ol className="flex items-center space-x-2 md:space-x-4">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <div className="flex items-center space-x-2 md:space-x-3">
              {/* Step Circle */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  {
                    "border-primary bg-primary text-primary-foreground": step.status === "completed",
                    "border-primary bg-background text-primary": step.status === "current",
                    "border-muted-foreground bg-background text-muted-foreground": step.status === "pending",
                  }
                )}
              >
                {step.status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step Text */}
              <div className="flex flex-col">
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    {
                      "text-foreground": step.status === "completed" || step.status === "current",
                      "text-muted-foreground": step.status === "pending",
                    }
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="text-xs text-muted-foreground hidden md:block">
                    {step.description}
                  </span>
                )}
              </div>
            </div>

            {/* Separator */}
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-2 md:mx-4 flex-shrink-0" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Compact horizontal version for smaller spaces
export function CompactWorkflowBreadcrumb({ steps, className }: WorkflowBreadcrumbProps) {
  return (
    <div className={cn("flex items-center justify-between w-full", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1">
          {/* Step */}
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                {
                  "bg-primary text-primary-foreground": step.status === "completed",
                  "bg-primary text-primary-foreground": step.status === "current",
                  "bg-muted text-muted-foreground": step.status === "pending",
                }
              )}
            >
              {step.status === "completed" ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium mt-1 transition-colors",
                {
                  "text-foreground": step.status === "completed" || step.status === "current",
                  "text-muted-foreground": step.status === "pending",
                }
              )}
            >
              {step.title}
            </span>
          </div>

          {/* Progress Line */}
          {index < steps.length - 1 && (
            <div className="flex-1 h-px mx-2">
              <div
                className={cn(
                  "h-full transition-colors",
                  step.status === "completed" ? "bg-primary" : "bg-muted"
                )}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Vertical version for sidebar-style layouts
export function VerticalWorkflowBreadcrumb({ steps, className }: WorkflowBreadcrumbProps) {
  return (
    <nav aria-label="Workflow progress" className={cn("w-full", className)}>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start">
            <div className="flex items-center">
              {/* Step Circle */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  {
                    "border-primary bg-primary text-primary-foreground": step.status === "completed",
                    "border-primary bg-background text-primary": step.status === "current",
                    "border-muted-foreground bg-background text-muted-foreground": step.status === "pending",
                  }
                )}
              >
                {step.status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Vertical Line */}
              {index < steps.length - 1 && (
                <div className="absolute ml-4 mt-8 h-8 w-px">
                  <div
                    className={cn(
                      "h-full w-full transition-colors",
                      step.status === "completed" ? "bg-primary" : "bg-muted"
                    )}
                  />
                </div>
              )}
            </div>

            {/* Step Content */}
            <div className="ml-4 flex-1">
              <h4
                className={cn(
                  "text-sm font-medium transition-colors",
                  {
                    "text-foreground": step.status === "completed" || step.status === "current",
                    "text-muted-foreground": step.status === "pending",
                  }
                )}
              >
                {step.title}
              </h4>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}