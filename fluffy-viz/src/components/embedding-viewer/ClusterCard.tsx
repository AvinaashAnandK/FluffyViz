'use client';

/**
 * ClusterCard Component
 *
 * Displays a cluster's information in a card format with:
 * - Named state: title, labels, description + examples
 * - Unnamed state: examples only with cluster ID
 * - Inline edit mode for manual title editing
 * - Expandable example text
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClusterLabel } from '@/lib/embedding/storage';

interface ClusterCardProps {
  clusterId: number;
  pointCount: number;
  examples: string[];
  label?: ClusterLabel;
  isEditing: boolean;
  onEditStart: () => void;
  onEditSave: (title: string) => void;
  onEditCancel: () => void;
}

export function ClusterCard({
  clusterId,
  pointCount,
  examples,
  label,
  isEditing,
  onEditStart,
  onEditSave,
  onEditCancel,
}: ClusterCardProps) {
  const [editValue, setEditValue] = useState(label?.title || '');
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const isNamed = !!label;
  const TRUNCATE_LENGTH = 80;
  const DESCRIPTION_TRUNCATE_LENGTH = 100;

  const handleSave = () => {
    if (editValue.trim()) {
      onEditSave(editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onEditCancel();
    }
  };

  const toggleExample = (index: number) => {
    setExpandedExamples(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllExamples = () => {
    if (expandedExamples.size === examples.length) {
      setExpandedExamples(new Set());
    } else {
      setExpandedExamples(new Set(examples.map((_, i) => i)));
    }
  };

  return (
    <Card className={`relative ${isNamed ? 'border-l-4 border-l-primary' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter cluster title..."
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleSave}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onEditCancel}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">
                  {isNamed ? label.title : `Cluster ${clusterId}`}
                </h3>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {pointCount} points
                </Badge>
              </div>
            )}
          </div>

          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={onEditStart}
              title="Edit title"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Labels (only shown when named and not editing) */}
        {isNamed && !isEditing && label.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {label.labels.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Description (only shown when named and not editing) */}
        {isNamed && !isEditing && label.description && (
          <div className="mb-3">
            {label.description.length > DESCRIPTION_TRUNCATE_LENGTH ? (
              <div
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/80"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                <p className={descriptionExpanded ? '' : 'line-clamp-2'}>
                  {descriptionExpanded
                    ? label.description
                    : label.description.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trim() + '...'}
                </p>
                <span className="text-xs text-primary mt-1 inline-block">
                  {descriptionExpanded ? 'Show less' : 'Show more'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {label.description}
              </p>
            )}
          </div>
        )}

        {/* Examples section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Examples
            </span>
            {examples.some(ex => ex.length > TRUNCATE_LENGTH) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs text-muted-foreground"
                onClick={toggleAllExamples}
              >
                {expandedExamples.size === examples.length ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse all
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Expand all
                  </>
                )}
              </Button>
            )}
          </div>

          {examples.map((example, i) => {
            const isExpanded = expandedExamples.has(i);
            const needsTruncation = example.length > TRUNCATE_LENGTH;
            const displayText = isExpanded || !needsTruncation
              ? example
              : example.slice(0, TRUNCATE_LENGTH).trim() + '...';

            return (
              <div
                key={i}
                className={`text-xs text-muted-foreground bg-muted/50 rounded p-2 ${needsTruncation ? 'cursor-pointer hover:bg-muted/70' : ''}`}
                onClick={() => needsTruncation && toggleExample(i)}
              >
                <p className={isExpanded ? '' : 'line-clamp-2'}>
                  {displayText}
                </p>
                {needsTruncation && (
                  <span className="text-xs text-primary mt-1 inline-block">
                    {isExpanded ? 'Show less' : 'Show more'}
                  </span>
                )}
              </div>
            );
          })}

          {examples.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No examples available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
