# Cencore Platform - WRA 2026 Capability Assessment

## Overview
The Cencore Platform is an advanced organizational assessment ecosystem designed to evaluate partners across 17 Warfighter Readiness Assessment (WRA) 2026 verticals and 9 progressive capability levels. Its primary purpose is to provide a comprehensive, dark-themed defense/military-grade UI for managing partner assessments, identifying capability gaps, and ensuring compliance. The platform aims to streamline the assessment process, enhance partner readiness, and offer robust tools for both administrators and partners to track progress and manage artifacts. Key capabilities include an Admin Command Center, Partner Home dashboard, automated artifact discovery, AI-driven recommendations and guidance, and a sophisticated assessment review workflow.

## User Preferences
I prefer iterative development with a focus on clear, maintainable code. Please use functional components for React and emphasize clear variable naming and code comments where necessary. Before making any major architectural changes or introducing new libraries, please discuss them with me. For UI/UX, maintain the dark theme and the specific color palette outlined in the design tokens. I value detailed explanations of complex implementations but prefer concise summaries for routine updates. Avoid making changes to any files within the `server/replit_integrations/` directory as these are managed by the Replit AI Integrations.

## System Architecture
The platform is built with a modern web stack: React 19 with TypeScript, Tailwind CSS, and shadcn/ui for the frontend; an Express.js REST API for the backend; and PostgreSQL with Drizzle ORM for data persistence. Routing is handled by `wouter` and state management by Redux Toolkit with RTK Query (fully migrated from TanStack React Query).

**UI/UX Decisions:**
- **Theme:** Supports light and dark modes with a three-way toggle (Light / Dark / Auto) in the sidebar footer. Default is dark. Theme preference is persisted in localStorage. A `ThemeProvider` context (`client/src/components/theme-provider.tsx`) manages the `dark`/`light` class on `<html>`. CSS variables in `index.css` define both `:root` (light) and `.dark` color palettes. Primary accent: HSL 60 30% 42%.
- **Fonts:** Inter (sans), JetBrains Mono (code), Source Serif 4 (serif).
- **Layouts:** Specific layouts for login (split-screen with wireframe soldier imagery) and admin/partner dashboards.
- **Components:** Reusable `AIChatPanel` for AI interactions and consistent `MaturityBadge`, `LevelBar`, and `RadarChart` components.

**Technical Implementations & Feature Specifications:**
- **Authentication:** Session-based authentication using `express-session` and `Passport` local strategy. Role-based access control (admin and partner) ensures data segregation, with partners only accessing their own organization's data.
- **Assessment System:** A per-capability assessment system features sub-capability selection, a radar chart dashboard, editable scores matrix, and gap analysis. A 4-step onboarding process (Identify → Discover → Assess → Register) guides new partners.
- **AI Integration:** Utilizes OpenAI via Replit AI Integrations (gpt-5-mini) for:
    - **AI Level Recommendation:** Suggests target levels based on profile and capability descriptions.
    - **AI Gap Advisor:** A streaming chat agent providing guidance for gap closure with full partner context.
    - **AI Admin/Partner Chatbots:** Context-aware streaming assistants available on all pages to assist with platform usage, policy, and readiness improvement.
    - **Automated Artifact Policy Compliance Scoring:** AI analyzes uploaded documents against artifact policies, providing scores and compliance details.
- **Workflow Management:**
    - **Capability Status Workflow:** Capabilities progress through `Pending → Approved → Published` states, with admin review.
    - **Assessment Review Workflow:** Partner submissions are reviewed by admins, leading to `Compliant` or `Non-Compliant` statuses, with a bi-directional feedback system.
    - **Document Workflow:** Scan → Submit → Approve verification.
- **File Preservation:** The PATCH endpoint for partner capabilities deep-merges `verticalSelections` to preserve `uploadedDocs` from the existing DB record. The background analysis function merges scores by document identity (`filePath`) rather than replacing arrays, preventing race conditions from overwriting files during concurrent activity.
- **Resources & Events:** Admins can upload resources (PDF/DOC/link, categorized) and create events (with image, dates, location). Both appear in partner-facing `/resources` and `/events` pages. Admin management pages live at the same routes but render the admin UI. Tables: `resources`, `events`.
- **Soft Delete:** Partner capabilities use soft delete (`deletedAt` timestamp column). Deleted capabilities are hidden from all queries but can be viewed in a "Recently Deleted" section and restored. The `DELETE /api/partner-capabilities/:id` endpoint sets `deletedAt`; `PATCH /api/partner-capabilities/:id/restore` clears it. `GET /api/partner-capabilities/deleted` returns soft-deleted items for the current user/admin.
- **Data Model:** Core entities include `partners`, `assessments`, `activities` (audit trail), `artifacts` (definitions), `partner_artifacts` (status tracking), `partner_documents` (uploaded files), `partner_capabilities` (partner-defined offerings), and `vertical_configs`. The `verticalSelections` JSONB column includes `uploadedDocs` with compliance scoring fields.
- **Reporting:** Report Card with compliance matrix drill-down and in-app document viewer.
- **Gap Analysis:** Identifies verticals below target levels and tracks artifact coverage (SAM-verified, user-uploaded, needed).
- **Automated Artifact Discovery:** Auto-verifies artifacts from SAM.gov upon registration.
- **Prerequisite Validation:** Ensures lower capability levels are met when higher levels are achieved.
- **Configuration Portal:** Admin interface for managing verticals, capabilities, sub-capabilities, and artifacts.

## External Dependencies
- **React 19**: Frontend library
- **TypeScript**: Superset of JavaScript for type safety
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: UI component library
- **Express.js**: Backend web application framework
- **PostgreSQL**: Relational database
- **Drizzle ORM**: TypeScript ORM for PostgreSQL
- **wouter**: React router library
- **Redux Toolkit + RTK Query**: State management and data fetching (40+ endpoint hooks in `client/src/lib/api.ts`)
- **OpenAI (via Replit AI Integrations)**: For AI functionalities (gap advisor, level recommendation, chatbots, compliance scoring).
- **connect-pg-simple**: PostgreSQL session store for `express-session`.
- **Passport**: Authentication middleware for Node.js.
- **SAM.gov (Emulated)**: External service for entity profile and artifact discovery (currently emulated by `server/sam-emulator.ts`).

## Production Data Seeding
- `server/seed-data.sql`: Full database dump (all tables except `session`) with `ON CONFLICT DO NOTHING` for idempotent restores.
- `server/seed.ts` → `runSeedDataDump()`: On startup, if no partners exist in DB, runs `seed-data.sql` inside a transaction with `SET LOCAL session_replication_role = 'replica'` to bypass FK ordering constraints. Rolls back atomically on failure.
- `script/build.ts`: Copies `seed-data.sql` to `dist/` during build so it's available in production.
- `uploads/` directory: Contains partner-uploaded documents referenced by `partner_capabilities.verticalSelections`. Stored at project root via `multer`.

## User Manuals
- `client/public/manual/admin-manual.html` and `partner-manual.html`: Role-specific user guides with screenshots.
- "User Manual" button in app header opens the appropriate manual based on user role.

## WIP Pages
- Partner sidebar items without full implementations (Ecosystem, Opportunities, Resources, Events, Inbox, Finance) route to a polished "Under Construction" placeholder page at `client/src/pages/work-in-progress.tsx`.