# Design Guidelines: Real-Time Collaboration Platform

## Design Approach

**System Selected**: Linear + VS Code + Figma-inspired design system
**Justification**: This is a utility-focused productivity tool where efficiency, clarity, and consistent patterns drive user success. Drawing from Linear's clean interface, VS Code's editor ergonomics, and Figma's collaborative workspace design.

**Core Principles**:
- Information density without clutter
- Purposeful use of space for functional areas
- Minimal visual noise to support focus
- Consistent, predictable interaction patterns

---

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) for UI elements and labels
- Monospace: JetBrains Mono for code editor

**Hierarchy**:
- App Title/Logo: 600 weight, text-xl
- Section Headers: 600 weight, text-sm uppercase tracking-wide
- Body/Labels: 500 weight, text-sm
- Secondary/Meta: 400 weight, text-xs
- Code Editor: 400 weight, text-sm monospace

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 3, 4, 6, 8, 12** consistently
- Component padding: p-3 or p-4
- Section gaps: gap-4 or gap-6
- Panel margins: m-2 or m-4
- Icon sizes: w-4 h-4 or w-5 h-5

**Grid Structure**:
- Main canvas: CSS Grid with explicit areas for sidebar, workspace, video bar
- Resizable split panels for editor/whiteboard (50/50 default split)
- Bottom video grid: Auto-fit columns, 4-6 participant thumbnails visible

---

## Application Layout Architecture

### Top Navigation Bar
- Height: h-14 fixed
- Content: Logo (left), Room name/slug (center), Theme toggle + User avatar (right)
- Spacing: px-4, flex justify-between items-center
- Separator: 1px border bottom

### Left Sidebar (Tools Panel)
- Width: w-16 collapsed, w-64 expanded (toggle-able)
- Content: Whiteboard tools (pen, eraser, shapes, color picker), Code settings
- Tool buttons: p-3, icon-only when collapsed, icon + label when expanded
- Active state: Subtle border accent or background treatment

### Main Workspace (Split View)
- Use React Split for resizable panels
- Left Panel: Monaco Code Editor (full height, minimal chrome)
- Right Panel: Fabric.js Whiteboard Canvas
- Divider: w-1 draggable handle with hover state
- Each panel header: h-10 with title and action buttons (export, undo/redo)

### Bottom Video Bar
- Height: h-32 when active, h-0 when collapsed
- Grid layout: grid-cols-auto-fit with gap-2
- Video tiles: Aspect ratio 4:3, rounded corners, participant name overlay
- Controls: Mute/unmute, camera on/off, minimize positioned bottom-right of bar

---

## Component Library

### Authentication Screens (Login/Register)
- Centered card: max-w-md, p-8, shadow-lg
- Form inputs: h-10, px-3, rounded-md with focus ring
- Submit button: w-full, h-10, rounded-md, 600 weight

### Dashboard
- Header: h-20 with welcome message and "Create Room" button
- Room grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6
- Room cards: p-6, rounded-lg, border, hover elevation
- Card content: Room name (text-lg), last active (text-xs), member count, "Join" button

### Presence Indicators
- Live cursor overlay: Absolute positioned SVG pointer with username label
- Username label: px-2 py-1, text-xs, rounded-full, offset 12px from cursor
- Active users list: Fixed top-right, avatar stack with +N overflow indicator

### Tool Panels
- Color picker: Compact grid of 8-12 preset swatches, 8x8 squares with gap-1
- Drawing tools: Vertical icon stack, p-2 each, 40x40 touch targets
- Undo/Redo: Icon buttons in editor header, disabled state at 50% opacity

### Video Chat Controls
- Participant tile: Relative container with video element, name overlay at bottom
- Control buttons: Circular, w-10 h-10, icon-only, grouped horizontally
- Mute indicator: Small icon badge on avatar when audio off

---

## Interaction Patterns

### Minimal Animations (Critical Paths Only)
- Panel resize: Smooth transform during drag
- Theme toggle: 200ms fade transition
- Tool selection: Instant feedback, no delay
- Modal overlays: 150ms fade-in when opening room settings
- NO scroll animations, parallax, or decorative motion

### Focus States
- All interactive elements: 2px focus ring with offset
- Editor/Canvas: Full panel highlight on focus to indicate active context
- Keyboard shortcuts: Display shortcut hints on hover (text-xs, opacity-60)

---

## Responsive Behavior

**Mobile (< 768px)**:
- Stack editor and whiteboard vertically, full-width panels
- Sidebar: Drawer overlay instead of inline
- Video grid: Single column, 2 participants visible, scroll for more
- Hide secondary UI elements (cursor names, minimize video bar)

**Tablet (768px - 1024px)**:
- Side-by-side split maintained
- Sidebar: Collapsible to icon-only
- Video grid: 2-3 columns

**Desktop (> 1024px)**:
- Full experience as designed
- Support ultra-wide monitors with max-w-screen-2xl container

---

## Critical Constraints

- Never obstruct canvas/editor with floating elements
- Maintain consistent 4px or 8px border radius throughout
- Use 1px borders for dividers and panel separators
- All iconography from single library (Heroicons recommended)
- Panel headers: Always visible, never scroll away
- Avoid overlapping UI layers except for modals and dropdowns