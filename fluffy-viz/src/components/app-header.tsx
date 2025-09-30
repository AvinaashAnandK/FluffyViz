"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useFileStorage } from '@/hooks/use-file-storage';
import { Menu, FolderOpen } from 'lucide-react';

export function AppHeader() {
  const { files } = useFileStorage();

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled
          >
            <Menu className="h-4 w-4" />
          </Button>

          {files.length > 0 && (
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Future: Add other header actions like theme toggle, user menu, etc. */}
        </div>
      </div>
    </header>
  );
}
