"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useFileStorage } from '@/contexts/file-storage-context';
import { Menu, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppHeader() {
  const { toggleSidebar, files, sidebarOpen } = useFileStorage();

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center space-x-2">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}

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