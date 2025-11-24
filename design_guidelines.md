# Design Guidelines: Personal Schedule Management Admin Interface

## Design Approach

**Selected Approach**: Design System + Reference-Based Hybrid

**Primary System**: Material Design 3 principles for content-rich, data-heavy interfaces  
**Reference Inspiration**: Linear (typography & spacing), Notion (data organization), Google Calendar (calendar UI patterns)

**Core Principles**:
- Information clarity over visual flourish
- Efficient data density with breathing room
- Scannable hierarchy for quick decision-making
- Purposeful interactions that reduce cognitive load

---

## Typography System

**Font Family**: 
- Primary: 'Inter' (Google Fonts) - body text, labels, data
- Display: 'Inter' at heavier weights (600-700) - headings, section titles

**Type Scale**:
- Page Headers: text-3xl font-semibold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Card/Component Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Supporting Text: text-sm text-gray-600 (14px)
- Metadata/Labels: text-xs uppercase tracking-wide (12px)

**Line Heights**: Use relaxed (1.625) for body text, tight (1.25) for headings

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8, 12, 16**
- Micro spacing (component internals): p-2, gap-2, space-y-4
- Component padding: p-4, p-6
- Section spacing: py-8, py-12, gap-8
- Page margins: px-4 md:px-6 lg:px-8
- Large separations: mb-16, space-y-12

**Grid System**:
- Dashboard: 12-column grid (grid-cols-12) with responsive breakpoints
- Calendar view: Full-width with sidebar (grid-cols-[280px_1fr])
- Event cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Data tables: Full-width with horizontal scroll on mobile

**Container Strategy**:
- Max-width: max-w-screen-2xl mx-auto for dashboard
- Sidebar: Fixed width 280px on desktop, drawer on mobile
- Content panels: Flexible with min-width constraints

---

## Component Library

### Navigation & Layout

**Top Navigation Bar**:
- Height: h-16
- Contains: Logo/title (left), search bar (center), user profile + notifications (right)
- Sticky positioning: sticky top-0 z-50
- Border: border-b with subtle shadow

**Sidebar Navigation**:
- Width: w-70 (280px) on desktop
- Collapsible on tablet/mobile to hamburger menu
- Nav items: p-3 rounded-lg with icon + label layout
- Active state: Distinct background treatment
- Sections: Dashboard, Calendar, Events, Conflicts, Settings

### Calendar Components

**Weekly Calendar View**:
- Time grid: 7-day horizontal layout with hourly rows
- Event blocks: Absolute positioned within time slots
- Color coding: Study events vs Personal events (use opacity/pattern differentiation, not color names)
- Hover states: Expand to show full details
- Click action: Opens event detail modal

**Daily Agenda List**:
- Chronological card-based layout
- Each event card: p-4 rounded-lg border with left accent bar
- Time badge, title, location, category indicator
- Conflict indicator: Warning icon with badge

**Month View (Optional Secondary)**:
- Grid of date cells with event dots
- Click to drill into daily view

### Event Management

**Event Cards**:
- Structure: Flex layout with icon (left), content (center), actions (right)
- Spacing: p-4 gap-3
- Typography: Title (text-base font-medium), Time/location (text-sm)
- Metadata row: Badges for type, status, conflicts
- Actions: Edit and delete icons (text-gray-400 hover states)

**Event Detail Modal**:
- Max-width: max-w-2xl
- Sections: Event info, conflict warnings, edit/delete actions
- Close button: top-right with backdrop click-to-close

**Event Creation/Edit Form**:
- Field spacing: space-y-6
- Label-input pairs: Label (text-sm font-medium mb-2), Input (p-3 rounded-lg border)
- Input types: Text, datetime-local, select dropdowns, textarea
- Toggle for "Study Event" vs "Personal Event"
- Submit: Primary button (full width on mobile, inline on desktop)

### Conflict Detection

**Conflict Alert Banner**:
- Position: Top of calendar view, mb-6
- Layout: Flex with warning icon, message, action button
- Style: p-4 rounded-lg border-l-4
- Dismissible: X button on right

**Conflict Detail Panel**:
- Shows overlapping events side-by-side
- Visual timeline representation
- Priority indicator (Study always wins)
- Suggested resolution actions

### Data Tables

**Event History/Logs Table**:
- Headers: sticky top-0, font-medium text-sm
- Rows: p-4 border-b hover state
- Columns: Date, Event, Type, Status, Actions
- Responsive: Stack to cards on mobile
- Pagination: Bottom with prev/next + page numbers

### Dashboard Widgets

**Statistics Cards**:
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Card structure: p-6 rounded-xl border shadow-sm
- Content: Icon, large number (text-3xl font-bold), label (text-sm)

**Upcoming Events Widget**:
- Compact list with next 5 events
- Mini event cards: p-3 space-y-2
- Quick actions: View calendar link

**Conflict Summary**:
- Count badge, list of recent conflicts
- Link to full conflict management page

### Forms & Inputs

**Text Inputs**:
- Height: h-12
- Padding: px-4
- Border: border rounded-lg
- Focus: ring-2 treatment
- Error state: Border change with error message (text-sm) below

**Select Dropdowns**:
- Custom styled with chevron icon
- Options list: p-2 rounded-lg
- Max-height with scroll for long lists

**File Upload (ICS)**:
- Drag-and-drop zone: border-2 border-dashed p-8 rounded-xl
- Upload button as fallback
- Preview section showing parsed events before import

**Buttons**:
- Primary: px-6 py-3 rounded-lg font-medium
- Secondary: px-6 py-3 rounded-lg border font-medium
- Icon buttons: p-2 rounded-lg
- Sizes: Small (py-2 px-4), Medium (py-3 px-6), Large (py-4 px-8)

### Notifications

**Toast Notifications**:
- Position: fixed top-4 right-4
- Width: max-w-sm
- Layout: p-4 rounded-lg shadow-lg
- Icon + message + close button
- Auto-dismiss after 5 seconds
- Types: Success, error, warning, info

**Email Settings Panel**:
- Toggle switches for notification preferences
- Email input with validation
- Test notification button
- Frequency selector (immediate, daily digest, weekly)

---

## Accessibility Features

**Keyboard Navigation**:
- All interactive elements must be keyboard accessible
- Visible focus states (ring-2 with offset)
- Skip-to-content link at top
- Tab order follows logical reading flow

**Screen Reader Support**:
- ARIA labels on all icon-only buttons
- ARIA-live regions for dynamic content updates (conflicts, notifications)
- Semantic HTML throughout (nav, main, article, section)
- Form labels explicitly connected to inputs

**Visual Accessibility**:
- Text contrast minimum 4.5:1 for body, 3:1 for large text
- Focus indicators with 3px minimum width
- Icon + text labels (icons alone not relied upon)
- Generous tap targets: minimum 44x44px

---

## Icons

**Library**: Heroicons (via CDN)
- Use outline variant for navigation and actions
- Use solid variant for status indicators and filled states
- Icon size: w-5 h-5 (20px) for inline, w-6 h-6 (24px) for buttons

**Common Icons**:
- Calendar, Clock, MapPin, Users, Bell, AlertTriangle, Check, X, ChevronDown, Menu, Search, Settings, Plus, Edit, Trash

---

## Images

**No hero images required** for this admin interface. This is a data-focused dashboard where visual imagery would distract from functionality. 

**User Avatars**:
- Use placeholder service or user initials in circular containers
- Size: w-8 h-8 (32px) for navigation, w-12 h-12 (48px) for profile areas

**Empty States**:
- Use simple illustration or icon-based graphics for empty calendar days, no events found, etc.
- Source from undraw.co or similar free illustration libraries

---

## Responsive Behavior

**Mobile (< 768px)**:
- Sidebar collapses to hamburger menu
- Calendar switches to agenda list view
- Data tables transform to stacked cards
- Bottom navigation bar for primary actions
- Single-column layouts throughout

**Tablet (768px - 1024px)**:
- 2-column grids where appropriate
- Persistent sidebar (collapsible)
- Calendar shows 3-4 days horizontal scroll

**Desktop (> 1024px)**:
- Full multi-column layouts
- Persistent sidebar
- Full week calendar view
- Multi-panel views (calendar + event detail side-by-side)