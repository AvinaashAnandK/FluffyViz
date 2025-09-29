# FluffyViz Development Context

## Project Overview
FluffyViz is a data visualization and analysis platform specifically designed for AI agent output data. It enables ML Engineers and AI Product Managers to transform raw conversational data into actionable insights through iterative augmentation and visualization.

## Core Value Proposition
- **What**: Add sentiment, topics, and custom analysis to conversational datasets
- **Who**: Built for ML engineers and AI product managers
- **How**: 4-step workflow: Upload → Augment → Process → Visualize

## Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Icons**: Lucide React
- **Language**: TypeScript
- **Development**: Hot reload via `npm run dev`

## Project Structure
```
fluffy-viz/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main landing page
│   │   └── style-guide/page.tsx  # Comprehensive design system
│   ├── components/
│   │   ├── ui/                   # Shadcn base components
│   │   ├── enhanced-upload.tsx   # Primary upload + processing workflow
│   │   ├── app-sidebar.tsx       # Agent dataset management sidebar
│   │   └── workflow-breadcrumb.tsx # Navigation components
│   └── lib/
│       └── utils.ts              # Utility functions
├── public/
│   └── FluffyVisualizer.png      # Brand mascot logo
└── package.json
```

## Design System & Branding

### Brand Identity
- **Primary Color**: `#454372` (Purple) in light mode, `#7c7aad` in dark mode
- **Typography**: Open Sans font family
- **Mascot**: FluffyVisualizer.png - cute purple character with horns and monocle
- **Tone**: Professional but approachable, technical but not intimidating

### Style Guide
Comprehensive design system located at `/style-guide` includes:
- Color palettes (light/dark modes)
- Typography hierarchy
- Button variants and states
- Form elements and validation
- Data display components (tables, cards, progress)
- Workflow visualization components
- Interactive breadcrumb navigation
- File upload patterns
- Badges and status indicators
- Charts and data visualization examples

## Current Page Structure

### Landing Page (`/`)
1. **Hero Section**
   - FluffyViz title with integrated FluffyVisualizer.png logo ✅
   - Logo positioned left of title (64x64px, proper spacing)
   - Expanded description text (max-w-4xl)
   - No action buttons (simplified for focus)

2. **Upload Section**
   - Enhanced upload interface matching style guide ✅
   - Professional messaging: "Analyze, enrich, expand your data"
   - Supports: CSV, JSON, JSONL, TXT
   - Drag & drop functionality with visual feedback
   - Files persist in IndexedDB-backed storage and reappear in sidebar lists
   - File dismissal with X button resets detection state for current session ✅
   - Style guide aligned button text: "Drop or click to import a file" ✅

3. **Workflow Section**
   - 4-step process cards
   - Clear visual hierarchy with numbered steps
   - Consistent spacing and typography

4. **Target Users Section**
   - Two main personas: ML Engineers, AI Product Managers
   - Specific pain points and use cases

5. **Credits Section**
   - Replaced promotional CTA with open source attribution
   - Links to HuggingFace AISheets and Apple Embedding Atlas
   - GitHub icons with consistent button styling

## Key Development Decisions Made

### UI/UX Simplifications
1. **Removed hero buttons** - Eliminated "View Style Guide" and "Get Started" for cleaner focus
2. **Streamlined upload flow** - Removed description textarea and trending tags to reduce friction
3. **Expanded text width** - Hero text now uses max-w-4xl instead of max-w-2xl for better readability
4. **Unified button styling** - Both GitHub links use secondary variant for visual consistency

### Technical Implementation
1. **Component Architecture** - Modular approach with reusable upload components
2. **Responsive Design** - Mobile-first approach with md: breakpoints
3. **Accessibility** - Proper ARIA labels, keyboard navigation, semantic HTML
4. **Performance** - Next.js Image optimization, code splitting

### Content Strategy
1. **Technical Audience Focus** - Copy speaks directly to ML engineers and product managers
2. **Clear Value Proposition** - Specific about what the tool does and who it's for
3. **Open Source Attribution** - Honest crediting of inspirational projects

## File Upload Component Details

### Main Features
- Drag and drop interface with visual feedback and keyboard support
- File type validation (CSV, JSON, JSONL, TXT) with helpful errors
- File size display, status indicators, and progress feedback
- IndexedDB persistence via `useFileStorage` hook (auto-save + manual save)
- Programmatic control through `EnhancedUploadHandle` for sidebar integration
- Multiple upload states (empty, active, selected, processing)

### Removed Features (for simplification)
- Dataset description textarea
- Trending examples/tags
- AI analysis description feature

### Component Variants
- `EnhancedUpload` - Full-featured main component used across the app and style guide
- Sidebar trigger uses the same component through an imperative ref for seamless reuse

## Recent Development Work (2025-01-28)

### ✅ Completed Tasks - Style Guide Alignment Sprint
**Commit: 975ee2f** - "Update upload component styling and functionality to match style guide"

#### 1. **Style Guide Comparison & Alignment**
- Conducted detailed visual comparison between main upload component and `/style-guide` page
- Used Chrome DevTools MCP for precise UI analysis
- Identified and documented styling inconsistencies

#### 2. **Upload Component Messaging Updates**
- **Before**: Generic "Drop your file here or click to browse"
- **After**: Professional style guide messaging:
  - "Analyze, enrich, expand your data" (headline)
  - "Upload your conversational data to get started" (subtitle)
  - "Drop or click to import a file" (button text)

#### 3. **Logo Integration**
- Successfully integrated FluffyVisualizer.png into hero section
- Positioned logo (64x64px) to the left of FluffyViz title
- Proper spacing and alignment with existing typography hierarchy

#### 4. **File Dismissal Functionality**
- Added X button to remove uploaded files
- **Important**: Implemented non-persistent behavior - when file is dismissed, ALL format detection results and preview data are cleared
- Clean slate approach ensures users start fresh with each upload session

#### 5. **Technical Improvements**
- Fixed compilation errors by adding missing `cn` import from `@/lib/utils`
- Enhanced UI with proper visual hierarchy matching style guide
- Maintained all existing drag & drop and file validation functionality

### Enhanced Upload Component Features
```typescript
// Key functionality added:
const removeFile = useCallback(() => {
  setFile(null);
  setProcessing(false);
  setProgress(0);
  // Clear all detection results and preview data when file is dismissed
  setPreviewData([]);
  setDetectionResult(null);
  setSelectedFormat('');
  setFieldMappings([]);
}, []);
```

## Recent Development Work (2025-02-05)

### ✅ Completed Tasks - Agent Dataset Persistence & Sidebar Experience
**Uncommitted prior to this update** - Batched changes ready for commit

#### 1. **Browser Storage & Synchronisation**
- Implemented IndexedDB-backed storage (`FluffyVizDB`/`files` store) via `useFileStorage`
- Added `saveFile`, `renameFile`, `deleteFile`, and `clearAllFiles` utilities with global change events
- Storage records keep content, MIME type, format, size, and `lastModified` timestamps for sidebar display

#### 2. **EnhancedUpload Refactor**
- Converted component to `forwardRef` exposing `loadFile` and `clear` methods for sidebar-driven flows
- Auto-saves newly detected files (unless explicitly skipped) and reuses stored ids when reprocessing
- Improved drag feedback, progress handling, and state resets when the underlying dataset is removed

#### 3. **Agent Datasets Sidebar**
- Introduced dedicated sidebar section with dataset counter, upload dropzone, and per-file metadata cards
- Each entry displays name, format badge, size, relative `lastModified`, and quick actions (rename + delete)
- Added "Delete All Files" call-to-action with confirmation dialog and integrated `clearAllFiles`
- Sidebar uploads emit rich `FileSelectionEventDetail` objects to drive the central uploader without duplication

#### 4. **Global UI Feedback**
- Header counter mirrors total stored files when sidebar is closed; hidden while sidebar is open to avoid duplication
- Selecting stored datasets scrolls to the upload section, loads the file, and tracks the active stored id so that deleting it clears the UI

```typescript
export interface FileSelectionEventDetail {
  file: File;
  source: 'main-upload' | 'sidebar-upload' | 'sidebar-stored';
  storedFileId?: string;
  skipInitialSave?: boolean;
}
```

## Git History
- **Initial Commit**: Basic Next.js setup with Shadcn and style guide
- **Component Addition**: File upload and navigation components
- **UI Streamlining**: Streamlined UI with GitHub credits (commit: 2a4c906)
- **Style Guide Alignment**: Updated upload component styling and added logo integration (commit: 975ee2f) ✅

## Development Environment
- **Port**: 3000 (http://localhost:3000)
- **Hot Reload**: Active via background process
- **Dev Command**: `npm run dev`

## Next Developer Considerations

### Immediate Opportunities
1. ~~**Logo Integration** - FluffyVisualizer.png is available but not currently displayed in hero~~ ✅ **COMPLETED**
2. **File Processing** - Upload functionality exists but needs backend integration for actual data processing
3. **Workflow Navigation** - Breadcrumb components exist but aren't connected to routing
4. **Data Visualization** - Chart components in style guide ready for implementation
5. **Format Detection Integration** - Upload component has detection logic but needs proper backend services

### Technical Debt
1. **TypeScript Strict Mode** - May need configuration updates
2. **Error Boundaries** - Add React error boundaries for better UX
3. **Loading States** - File upload needs proper loading/progress indicators
4. **Routing** - Workflow steps need Next.js routing implementation

### Content & Copy
1. **Copy Review** - Current copy was flagged as potentially too verbose/buzzword-heavy
2. **Technical Specifications** - Upload section could benefit from more specific technical details
3. **Examples** - Workflow could use concrete examples instead of generic descriptions

### Performance & Optimization
1. **Bundle Analysis** - Check for unnecessary dependencies
2. **Image Optimization** - Ensure all images use Next.js Image component
3. **SEO** - Add meta tags and structured data
4. **Analytics** - Consider adding user behavior tracking

## Files Currently Untracked
- `.claude/` - Claude Code configuration
- `.mcp.json` - MCP configuration
- `FluffyVisualizer.png` - Logo (root level, copy exists in public/)
- `ProjectDetails/` - This documentation folder
- `retained-upload-functionality/` - Backup of removed features

## Important Notes for Next Developer
1. **Style Guide is Comprehensive** - Don't reinvent UI patterns, check `/style-guide` first
2. **Mobile-First Approach** - All components should work on mobile before desktop
3. **Accessibility Matters** - Follow WCAG guidelines, use semantic HTML
4. **Open Source Ethos** - Keep attribution to HuggingFace AISheets and Apple Embedding Atlas
5. **Technical Audience** - Users are ML engineers and PM's, avoid over-simplification
6. **Brand Personality** - Balance professionalism with the cute FluffyViz mascot charm

## Environment Setup for New Developer
```bash
cd fluffy-viz
npm install
npm run dev
# Navigate to http://localhost:3000
# Style guide: http://localhost:3000/style-guide
```

## ✅ COMPLETED: Sidebar Implementation Sprint (2025-01-29)

### **Commit: 9261f9a** - "Implement comprehensive sidebar with file storage and dataset management"

#### 1. **Sidebar Component Implementation**
- Successfully implemented collapsible sidebar inspired by shadcn dashboard blocks
- Custom styling with `#D1CCDC` background color as requested
- Responsive design with proper mobile considerations
- Integrated with SidebarProvider from shadcn/ui components

#### 2. **File Storage & Management System**
- **Local Storage Hook** (`use-file-storage.ts`):
  - Persistent storage of uploaded files using localStorage
  - Automatic state management for active file selection
  - File metadata storage (name, size, type, upload date)
  - Format detection results and preview data persistence

- **File Management Features**:
  - Upload new files via sidebar button
  - Switch between multiple uploaded datasets
  - File renaming with prompt interface
  - Individual file deletion
  - Bulk "Delete All Files" functionality
  - Visual file type indicators (CSV, JSON, JSONL, TXT)
  - File size and upload date display
  - Active file highlighting with badges

#### 3. **Enhanced Upload Component Integration**
- Modified `enhanced-upload.tsx` to support initial data loading
- Added `onFileSelected` callback for storage integration
- Support for `initialDetectionResult` and `initialPreviewData` props
- Proper state management when switching between stored files
- Non-persistent behavior maintained (clearing all data when file dismissed)

#### 4. **Main Page Architecture Updates**
- Integrated SidebarProvider and SidebarInset layout
- Added header with sidebar toggle and dataset counter
- Enhanced state management for active file handling
- Proper coordination between upload component and sidebar state
- Upload results display immediately after processing

#### 5. **TypeScript Integration**
- Comprehensive `StoredFile` interface with all required fields
- Proper typing for detection results and preview data
- Type-safe file management operations
- Export of interfaces for reuse across components

### Technical Implementation Details

#### File Storage Hook Features
```typescript
// Key functionality:
const {
  storedFiles,        // Array of all stored files
  activeFileId,       // Currently selected file ID
  activeFile,         // Currently selected file object
  addFile,           // Add new file to storage
  removeFile,        // Delete file from storage
  selectFile,        // Switch active file
  updateFileData,    // Update file metadata
  renameFile,        // Rename stored file
  clearAllFiles      // Clear all storage
} = useFileStorage();
```

#### Sidebar Component Architecture
- File list with visual hierarchy
- File type icons (Database for CSV, Code2 for JSON/JSONL, FileText for TXT)
- Format badges showing detected data format
- Action buttons for rename and delete
- Upload new file button at top
- Delete all files button at bottom
- Disabled "Configure LLM Provider" placeholder for future enhancement

#### State Management Flow
1. **File Upload**: New files added to storage automatically
2. **File Selection**: Clicking sidebar file loads its data into upload component
3. **Format Detection**: Results saved to storage and restored when file reselected
4. **Data Processing**: Preview data and processing results persist in storage
5. **File Switching**: Clean transitions between datasets without data loss

### Testing Completed
- Used Chrome DevTools MCP for UI validation ✅
- Tested with sample data files from `/public/sample-data/` ✅
- Verified localStorage persistence across browser sessions ✅
- Confirmed file deletion and renaming functionality ✅
- Validated format detection and preview data storage ✅

### Files Created/Modified
- **New Files**:
  - `fluffy-viz/src/components/app-sidebar.tsx` - Main sidebar component
  - `fluffy-viz/src/hooks/use-file-storage.ts` - Storage management hook
  - Sample data files moved to root level for testing

- **Modified Files**:
  - `fluffy-viz/src/app/page.tsx` - Integrated sidebar and state management
  - `fluffy-viz/src/components/enhanced-upload.tsx` - Added storage integration
  - `ProjectDetails/development-context.md` - Updated documentation

### Known Technical Details
- **Persistence**: IndexedDB (`FluffyVizDB`, store `files`) accessed via `useFileStorage`
- **File ID Generation**: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- **State Sync**: Custom `filesStorageChanged` event keeps all hook instances in sync
- **Sidebar Styling**: Background `#D1CCDC`, secondary badge for counts
- **Format Badges**: `TURN LEVEL`, `ARIZE`, `LANGFUSE`, `LANGSMITH`, `MESSAGE CENTRIC`

---

## Next Development Phase: Data Processing & Analysis 🚀

### Immediate Next Steps
With the sidebar and file management system complete, the next developer should focus on:

1. **Backend Integration** - Connect upload processing to actual data transformation services
2. **Workflow Navigation** - Implement routing between the 4-step process (Upload → Augment → Process → Visualize)
3. **Data Augmentation UI** - Build interface for adding sentiment, topics, and custom analysis
4. **Visualization Components** - Implement the chart components from style guide
5. **Export Functionality** - Connect to external tools like Embedding Atlas

### Current State Summary
- ✅ **Upload System**: Fully functional with drag & drop, format detection, and file management
- ✅ **Storage System**: Complete local storage with multi-file support and persistence
- ✅ **UI Framework**: Comprehensive style guide and component library
- ✅ **Sidebar Navigation**: Professional dataset management interface
- 🔄 **Data Processing**: Ready for backend integration
- 🔄 **Workflow Steps**: Components exist but need routing implementation
- 🔄 **Data Visualization**: Chart components available but not connected

### Sample Data Available
- `sample-snowglobe-csv.csv` - For CSV format testing
- `sample-snowglobe-json.json` - For JSON format testing
- Located in project root for easy testing access

## Recent Updates

### 2025-09-30
- Added `src/components/ai-provider-config-demo.tsx` to power the "Configure LLM Providers" modal.
- Fixed provider list layout so the left rail no longer stretches past its content and the surrounding card grows with its inner sections (`items-start` grid alignment, `h-fit` card sizing).
- Introduced an eye toggle for API keys with read-only + disabled states after saving, reverting when cleared; also hides the key whenever the provider changes or a key is saved/cleared.
- Updated modal controls to disable the "Save key" button once a key has been stored, preventing accidental edits until the user clears the field.

---
*Last Updated: 2025-09-30*
*Context prepared following LLM provider configuration UX polish and credential-handling safeguards*
