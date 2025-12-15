'use client';

/**
 * Save Filter Modal
 *
 * Dialog for naming and saving the current embedding selection as a filter.
 * The filter can then be applied to the spreadsheet view.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveFilter, generateFilterId } from '@/lib/filters/storage';
import { Loader2 } from 'lucide-react';

interface SaveFilterModalProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  layerId: string;
  pointIds: string[];
  onSaved?: () => void;
}

export function SaveFilterModal({
  open,
  onClose,
  fileId,
  layerId,
  pointIds,
  onSaved,
}: SaveFilterModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a filter name');
      return;
    }

    if (pointIds.length === 0) {
      setError('No points selected');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Convert point IDs to row indices
      // Point IDs are in format "point_0", "point_1", etc.
      const rowIndices = pointIds.map(id => {
        const match = id.match(/point_(\d+)/);
        return match ? parseInt(match[1], 10) : -1;
      }).filter(idx => idx >= 0);

      await saveFilter({
        id: generateFilterId(),
        fileId,
        layerId,
        name: name.trim(),
        rowIndices,
      });

      // Reset state
      setName('');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving filter:', err);
      setError('Failed to save filter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Filter</DialogTitle>
          <DialogDescription>
            Save the current selection as a filter that can be applied to the spreadsheet view.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="filter-name">Filter Name</Label>
            <Input
              id="filter-name"
              placeholder="e.g., High quality responses"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) {
                  handleSave();
                }
              }}
              disabled={saving}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {pointIds.length} point{pointIds.length !== 1 ? 's' : ''} selected
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Filter'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
