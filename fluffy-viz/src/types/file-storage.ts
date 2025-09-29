export type FileSelectionSource = 'main-upload' | 'sidebar-upload' | 'sidebar-stored';

export interface FileSelectionContext {
  source: FileSelectionSource;
  storedFileId?: string;
}

export interface FileSelectionEventDetail extends FileSelectionContext {
  file: File;
  skipInitialSave?: boolean;
}
