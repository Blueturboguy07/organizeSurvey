# ORGanize TAMU

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-38B2AC?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python)

A comprehensive platform that helps Texas A&M University students discover and connect with student organizations that match their interests, while providing organizations with powerful tools to manage membership and applications.

---

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd organizeSurvey

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [For Students](#for-students)
  - [For Organization Representatives](#for-organization-representatives)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)

---

## Overview

ORGanize TAMU is a dual-sided platform serving both students and organization representatives:

- **Students** complete a survey and receive AI-powered organization recommendations based on their interests, career goals, and demographics
- **Organizations** manage their presence on the platform, handle applications, and track membership

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Intelligent Matching** | Weighted text matching algorithm analyzes survey responses to find the best organization matches |
| **Eligibility Filtering** | Automatically filters organizations based on demographics (gender, race, classification, sexuality) |
| **Application System** | Full-featured application workflow with custom forms, status tracking, and internal notes |
| **Custom Form Builder** | Organizations create custom application forms with multiple question types |
| **Member Management** | Role-based member management with officer/admin assignments |
| **Real-time Updates** | Live synchronization across all sessions using Supabase Realtime |
| **Dual User Types** | Separate interfaces and authentication flows for students and organization representatives |

---

## Features

### For Students

#### Dashboard Navigation

The student dashboard features a tabbed navigation with four main sections:

- **My Orgs** — View and manage organizations you've joined
- **Explore** — Browse all recommended organizations with filtering options
- **Saved** — Track organizations saved for later (including those not yet on the platform)
- **Applications** — Track your pending applications and their statuses

#### Multi-step Survey

Interactive survey with smooth Framer Motion animations capturing:

- Personal information and demographics (gender, race, classification, sexuality)
- Career interests and goals (14 career fields)
- Engineering specializations (22 types, if applicable)
- Activity preferences (volunteering, social events, projects, competitions, workshops, trips, etc.)
- Religious affiliations
- Primary goals for joining organizations

#### AI-Powered Recommendations

- Weighted text matching algorithm ranks organizations by relevance
- **All matching organizations displayed** with similarity scores
- Automatically filters out organizations already joined, saved, or applied to
- Eligibility-based filtering ensures only accessible organizations are shown
- Activity-based filters for refined searching

#### Join, Apply & Save System

| Action | Description |
|--------|-------------|
| **Join** | Directly join organizations that don't require applications |
| **Apply** | Submit applications for application-based organizations |
| **Save for Later** | Save organizations to track for later |
| **Express Interest** | Notify organizations not on the platform of student interest |
| **Track Applications** | View application status (waiting, interview, accepted, rejected) |

#### Profile Management

- Upload and manage profile pictures (stored in Supabase Storage)
- Update name and email preferences
- Reset survey responses to get new recommendations
- Email preference controls (marketing, updates, recommendations)

### For Organization Representatives

#### Organization Dashboard

A comprehensive dashboard for managing your organization:

- **Membership Settings** — Toggle between direct-join and application-based membership
- **Applications Dashboard** — View and manage all applications with real-time counts
- **Members Page** — View all members, assign roles, send invitations
- **Edit Info** — Update organization details in organized tabs (About, Details, Membership)

#### Custom Form Builder

Create sophisticated application forms with:

| Question Type | Features |
|---------------|----------|
| **Short Text** | Single-line responses |
| **Long Text** | Multi-line responses with configurable word limits |
| **Multiple Choice** | Single or multi-select options |
| **File Upload** | PDF uploads (up to 10 MB) for resumes, portfolios, etc. |

Form builder includes:
- Drag-and-drop question reordering
- Required/optional question settings
- Real-time preview
- Live sync across sessions

#### Application Management

Full application workflow with:

- **Status Tracking** — waiting, interview, accepted, rejected
- **Internal Notes** — Private notes visible only to org admins
- **Candidate Ranking** — Numeric ranking system for comparison
- **Application Deadline** — Set deadlines and reopen dates
- **Accept/Close Applications** — Control when applications are open

#### Member Management

- View all members with profile pictures and contact info
- **Role System** — member, officer, admin roles
- Grant dashboard access to admin members
- Send email invitations to prospective members
- Track pending invitations

#### Share & Promote

- Generate shareable application links (`/apply/[slug]`)
- Direct links for potential members to view and apply
- Interest notifications when students save your organization

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 14 | App Router framework with server components |
| TypeScript | Type-safe development |
| Tailwind CSS | Utility-first styling with custom TAMU theme |
| Framer Motion | Animations and transitions |
| React Context API | Central state management with AuthContext |
| @dnd-kit | Drag-and-drop functionality for form builder |

### Backend

| Technology | Purpose |
|------------|---------|
| Next.js API Routes | TypeScript API endpoints |
| Python Flask API | Search service with weighted matching algorithm |
| Supabase | PostgreSQL database with Row Level Security |
| Supabase Auth | Dual authentication (students vs org accounts) |
| Supabase Storage | Profile pictures and file uploads |
| Supabase Realtime | Live subscriptions for all tables |
| Resend | Email notifications and verifications |

### Python Dependencies

```
pandas          # Data manipulation
numpy           # Numerical operations
flask           # API server framework
flask-cors      # CORS support
gunicorn        # Production WSGI server
supabase        # Supabase Python client
python-dotenv   # Environment variable management
```

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App (Vercel)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │   Pages/UI     │  │  API Routes    │  │    Middleware      │ │
│  │  (React/TS)    │  │  (TypeScript)  │  │ (Auth Protection)  │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│    Supabase     │ │  Python   │ │     Resend      │
│  ┌───────────┐  │ │ Flask API │ │   (Email API)   │
│  │ Database  │  │ │ (Render)  │ └─────────────────┘
│  │ (Postgres)│  │ │           │
│  ├───────────┤  │ │  Weighted │
│  │   Auth    │  │ │  Search   │
│  ├───────────┤  │ │ Algorithm │
│  │  Storage  │  │ └───────────┘
│  ├───────────┤  │
│  │ Realtime  │  │
│  └───────────┘  │
└─────────────────┘
```

### Data Flow

```
Student Flow:
1. Registration → Supabase Auth → Email Verification → Profile Creation
2. Survey Submission → API Route → Supabase (user_queries) → Redirect to Dashboard
3. Recommendations → API Route → Python Search API → Weighted Matching → Filtered Results
4. Join/Apply → AuthContext → Supabase → Real-time Update to all sessions

Organization Flow:
1. Signup → Search org → Email verification → Account linking → Dashboard access
2. Edit Info → Inline editing → Supabase update → Real-time sync
3. Create Form → FormBuilder → Supabase (org_forms, form_questions)
4. Review Apps → Applications page → Status update → User notification
```

### Database Schema

The application uses 15+ interconnected tables:

| Table | Purpose |
|-------|---------|
| `user_profiles` | Student profile data, pictures, preferences |
| `user_queries` | Survey responses and cleansed query strings |
| `organizations` | Organization details and eligibility criteria |
| `org_accounts` | Organization representative accounts |
| `user_joined_organizations` | Membership records with roles |
| `user_saved_organizations` | Saved/bookmarked organizations |
| `applications` | Application submissions with status |
| `org_forms` | Custom form definitions per organization |
| `form_questions` | Individual questions with settings |
| `application_responses` | Answers to custom form questions |
| `application_drafts` | Auto-saved application drafts |
| `org_invitations` | Pending member invitations |
| `org_dashboard_access` | Admin member dashboard permissions |
| `org_interest` | Student interest tracking for off-platform orgs |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- Supabase account and project
- Resend account (for emails)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd organizeSurvey
   ```

2. **Install Node.js dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the project root:

   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Python Search API (optional for local dev)
   SEARCH_API_URL=http://localhost:5000

   # Resend (for emails)
   RESEND_API_KEY=your_resend_api_key
   ```

4. **Set up Supabase database**
   
   See [Database Setup](#database-setup) section below.

5. **Install Python dependencies** (optional, for local search API)

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

7. **Run Python API server** (optional)

   ```bash
   python api_server.py
   ```

   The API will run on `http://localhost:5000`.

---

## Database Setup

### Step 1: Create Tables

Run these SQL scripts in your Supabase SQL Editor in order:

| Script | Purpose |
|--------|---------|
| `supabase_setup.sql` | Creates `user_profiles` and `user_queries` tables with RLS policies |
| `supabase_organizations.sql` | Creates `organizations` table with eligibility criteria |
| `supabase_org_accounts.sql` | Creates `org_accounts` table for organization representatives |
| `supabase_user_joined_orgs.sql` | Creates `user_joined_organizations` table with roles |
| `supabase_user_saved_orgs.sql` | Creates `user_saved_organizations` table |
| `supabase_applications.sql` | Creates `applications` table with status tracking |
| `supabase_forms.sql` | Creates form builder tables (`org_forms`, `form_questions`, etc.) |
| `supabase_member_roles.sql` | Adds role/title columns to memberships |
| `supabase_org_invitations.sql` | Creates invitation system tables |
| `supabase_application_settings.sql` | Adds application deadline and settings |

### Step 2: Create Storage Buckets

1. **Profile Pictures Bucket**
   - Name: `profile-pictures`
   - Public: ✅ Enabled
   - File size limit: 5 MB
   - Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`

2. **Application Files Bucket**
   - Name: `application-files`
   - Public: ❌ Disabled (private)
   - File size limit: 10 MB
   - Allowed MIME types: `application/pdf`

See `BACKEND_SETUP.md` for detailed storage policy SQL.

### Step 3: Import Organization Data

If you have organization data:

```bash
python scripts/migrate_csv_to_supabase.py
```

### Step 4: Enable Real-time

Verify these tables have replication enabled in Supabase Dashboard → Database → Replication:

- `user_profiles`, `user_queries`
- `user_joined_organizations`, `user_saved_organizations`
- `organizations`, `org_accounts`
- `applications`, `org_forms`, `form_questions`

---

## API Documentation

### Student Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/submit` | POST | Submit survey responses (rate limited: 5/hour) |
| `/api/recommendations` | GET | Get personalized recommendations |
| `/api/search` | POST | Search organizations (rate limited: 30/min) |
| `/api/orgs/joined` | GET | Get joined organizations |
| `/api/orgs/saved` | GET | Get saved organizations |
| `/api/profile` | GET/PUT | Manage user profile |
| `/api/profile/upload` | POST | Upload profile picture |
| `/api/reset-profile` | POST | Reset survey responses |
| `/api/user/invitations` | GET | Get pending invitations |

### Organization Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/org/signup` | POST | Create organization account |
| `/api/org/login` | POST | Organization login helper |
| `/api/org/check-account` | POST | Check if org account exists |
| `/api/org/send-setup-link` | POST | Send setup link via email |
| `/api/org/complete-setup` | POST | Complete account setup |
| `/api/org/settings` | GET/PUT | Manage org settings |
| `/api/org/members` | GET/PATCH/DELETE | Manage members |
| `/api/org/invitations` | POST | Send member invitations |
| `/api/org/invite/check` | GET | Validate invitation token |
| `/api/org/invite/details` | GET | Get invitation details |
| `/api/org/interest` | POST | Record student interest |
| `/api/applications/notify` | POST | Send application notifications |

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/resend-verification` | POST | Resend email verification |
| `/api/auth/callback` | GET | OAuth callback handler |

---

## Deployment

### Frontend (Vercel)

1. **Connect repository to Vercel**

2. **Configure environment variables**:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL
   SEARCH_API_URL
   RESEND_API_KEY
   ```

3. **Deploy** — Vercel auto-deploys on push to main

### Python API (Render)

1. **Create Web Service** on Render

2. **Configure commands**:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn api_server:app --bind 0.0.0.0:$PORT`

3. **Set environment variables**:

   ```
   SUPABASE_URL
   SUPABASE_SERVICE_KEY
   USE_SUPABASE=true
   ```

4. **Update Vercel** with Render service URL

---

## Development

### Project Structure

```
organizeSurvey/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── org/                  # Organization endpoints
│   │   │   ├── members/          # Member management
│   │   │   ├── invitations/      # Invitation system
│   │   │   ├── settings/         # Org settings
│   │   │   └── ...
│   │   ├── orgs/                 # Joined/saved endpoints
│   │   ├── applications/         # Application notifications
│   │   ├── profile/              # Profile management
│   │   ├── recommendations/      # Recommendations API
│   │   ├── search/               # Search API
│   │   └── submit/               # Survey submission
│   ├── apply/[slug]/             # Public application page
│   ├── auth/                     # Authentication pages
│   ├── dashboard/                # Student dashboard
│   │   ├── page.tsx              # My Orgs
│   │   ├── explore/              # Explore recommendations
│   │   ├── saved/                # Saved organizations
│   │   └── applications/         # Application tracking
│   ├── org/                      # Organization pages
│   │   ├── dashboard/            # Org main dashboard
│   │   ├── applications/         # Application review
│   │   ├── members/              # Member management
│   │   └── setup/                # Account setup
│   ├── profile/                  # User profile settings
│   └── survey/                   # Survey form
├── components/
│   ├── DashboardLayout.tsx       # Student dashboard layout
│   ├── OrgCard.tsx               # Organization card with actions
│   ├── SurveyForm.tsx            # Multi-step survey
│   ├── FormBuilder.tsx           # Custom form builder
│   └── DynamicApplicationForm.tsx # Application form renderer
├── contexts/
│   └── AuthContext.tsx           # Central auth with real-time subscriptions
├── lib/
│   ├── rateLimit.ts              # Rate limiting utility
│   └── supabase.ts               # Supabase client configuration
├── scripts/
│   ├── migrate_csv_to_supabase.py
│   └── weighted_search.py        # Core matching algorithm
├── api_server.py                 # Python Flask API
├── middleware.ts                 # Route protection
└── supabase_*.sql                # Database setup scripts
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `AuthContext` | Central authentication with real-time subscriptions, org actions (join, leave, save, unsave, apply) |
| `DashboardLayout` | Student dashboard with tabbed navigation and badge counts |
| `OrgCard` | Reusable org card with join/apply/save buttons and detail modal |
| `FormBuilder` | Drag-and-drop form builder for custom applications |
| `DynamicApplicationForm` | Renders and validates custom application forms |
| `SurveyForm` | Multi-step survey with validation and animations |

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## Security

### Authentication

- Supabase Auth with JWT tokens and automatic refresh
- Email verification required for account activation
- Dual login flows (student vs organization)
- Secure password reset via email

### Data Protection

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Organization owners can only access their organization's data
- Service role key isolated to server-side only
- Input validation and sanitization on all endpoints

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Search API | 30 requests/minute/IP |
| Survey submission | 5 requests/hour/IP |

### Input Validation

- XSS protection (script tag detection)
- Honeypot fields for bot detection
- Email format validation
- File type and size validation
- SQL injection prevention via parameterized queries

### Storage Security

- Authenticated uploads only
- File type restrictions (images, PDFs)
- Size limits enforced
- Private buckets for sensitive files

---

## Contributing

### Development Workflow

1. **Fork the repository**

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes** following TypeScript best practices

4. **Test thoroughly**
   - Development mode testing
   - Real-time update verification
   - Auth flow testing
   - Cross-tab synchronization

5. **Submit a pull request**

### Code Style

- TypeScript for all new code
- Next.js App Router conventions
- Tailwind CSS for styling
- Functional components with hooks
- Use `useAuth()` for auth state and actions

---

## License

This project is private and intended for Texas A&M University use.

---

## Support

For issues or questions:

1. Check existing documentation
2. Review Supabase logs for database errors
3. Check browser console for client-side errors
4. Review API route logs in Vercel/Render
5. Contact: mannbellani1@tamu.edu

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Resend Documentation](https://resend.com/docs)
