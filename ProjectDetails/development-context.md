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
│   │   ├── file-upload.tsx       # Main upload component
│   │   ├── workflow-breadcrumb.tsx # Navigation components
│   │   └── ui/breadcrumb.tsx     # Base breadcrumb component
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
   - File dismissal with X button (no persistence) ✅
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
- Drag and drop interface with visual feedback
- File type validation (CSV, JSON, JSONL, TXT)
- File size display and status indicators
- Error handling and user feedback
- Multiple upload states (empty, active, selected)

### Removed Features (for simplification)
- Dataset description textarea
- Trending examples/tags
- AI analysis description feature

### Component Variants
- `FileUploadArea` - Full-featured main component
- `CompactFileUpload` - Minimal version for constrained spaces

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

## Next Development Phase: Sidebar Implementation 🚧

### Upcoming Tasks (Ultrathink Priority)
Based on user directive, next developer should implement:

1. **Sidebar Component** - Inspired by shadcn dashboard blocks
2. **File Management** - Local storage of uploaded datasets
3. **Dataset Switching** - Toggle between multiple agent datasets
4. **Custom Styling** - Background color: `#D1CCDC`
5. **Testing Protocol** - Test upload functionality with sample data files

### Reference Material
- Shadcn Dashboard Blocks: https://ui.shadcn.com/blocks
- Sample Data: Located in `/public/sample-data/` directory
- Testing: Use Chrome MCP and console logs for validation

---
*Last Updated: 2025-01-28*
*Context prepared for sidebar implementation phase*