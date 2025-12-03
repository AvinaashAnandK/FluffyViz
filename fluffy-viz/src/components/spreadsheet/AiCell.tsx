/**
 * AiCell - Status-aware cell renderer for AI-generated columns
 *
 * Renders cells based on their status:
 * - pending: Spinner animation
 * - success: Value with optional edit indicator
 * - failed: Error icon with tooltip showing error message
 */

import { AlertCircle, Clock, WifiOff, Key, ServerCrash, Pencil, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CellStatus, FailureType } from '@/lib/duckdb';

export interface AiCellMetadata {
  status: CellStatus;
  error?: string;
  errorType?: FailureType;
  edited: boolean;
  originalValue?: string;
  lastEditTime?: number;
}

export interface AiCellProps {
  value: string;
  metadata?: AiCellMetadata;
}

/**
 * Get appropriate icon based on error type
 */
function getErrorIcon(errorType?: FailureType) {
  switch (errorType) {
    case 'rate_limit':
      return Clock;
    case 'network':
      return WifiOff;
    case 'auth':
      return Key;
    case 'server_error':
      return ServerCrash;
    case 'invalid_request':
    default:
      return AlertCircle;
  }
}

/**
 * Get user-friendly error message based on error type
 */
function getErrorHint(errorType?: FailureType): string {
  switch (errorType) {
    case 'rate_limit':
      return 'Rate limit exceeded. Wait before retrying or switch providers.';
    case 'network':
      return 'Network error. Check your connection and retry.';
    case 'auth':
      return 'Invalid API key. Update your settings.';
    case 'server_error':
      return 'Server error. Retry or try a different model.';
    case 'invalid_request':
      return 'Invalid request. Check your prompt configuration.';
    default:
      return 'An error occurred during generation.';
  }
}

export function AiCell({ value, metadata }: AiCellProps) {
  // No metadata = treat as regular cell (success)
  if (!metadata) {
    return <span className="text-sm">{value}</span>;
  }

  // Pending state - show spinner
  if (metadata.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Generating...</span>
      </div>
    );
  }

  // Failed state - show error icon with tooltip
  if (metadata.status === 'failed') {
    const ErrorIcon = getErrorIcon(metadata.errorType);
    const errorHint = getErrorHint(metadata.errorType);

    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-destructive">
                <ErrorIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate max-w-[200px]">
                  {metadata.error || 'Generation failed'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-xs break-words z-50"
              sideOffset={5}
            >
              <div className="space-y-1">
                <p className="font-medium">{errorHint}</p>
                {metadata.error && (
                  <p className="text-xs text-muted-foreground break-words">{metadata.error}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // Success state - show value with optional edit indicator
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{value}</span>
        {metadata.edited && metadata.originalValue && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Pencil className="h-3 w-3 text-muted-foreground flex-shrink-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-md break-words z-50"
              sideOffset={5}
            >
              <div className="space-y-1">
                <p className="font-medium">Edited by user</p>
                <p className="text-xs text-muted-foreground break-words">
                  Original value: &ldquo;{metadata.originalValue}&rdquo;
                </p>
                {metadata.lastEditTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(Number(metadata.lastEditTime)).toLocaleString()}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
