# ORGanize TAMU

A full-stack web application that helps Texas A&M University students discover and connect with student organizations that match their interests and demographics. Built with Next.js, TypeScript, Tailwind CSS, Supabase, and Python.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)

## Overview

ORGanize TAMU solves the challenge of helping students find organizations that align with their interests, career goals, and eligibility criteria. The platform uses AI-powered matching algorithms to recommend organizations based on survey responses, while filtering by demographics such as gender, race, classification, and sexuality.

### Key Capabilities

- **Intelligent Matching**: Weighted text matching algorithm analyzes survey responses to find the best organization matches
- **Eligibility Filtering**: Automatically filters organizations based on user demographics and organization requirements
- **Real-time Updates**: Live synchronization of data across sessions using Supabase Realtime
- **Dual User Types**: Separate interfaces and authentication flows for students and organization representatives
- **Profile Management**: Upload profile pictures, manage preferences, and track joined organizations

## Features

### For Students

- **Multi-step Survey**: Interactive survey with smooth Framer Motion animations capturing:
  - Personal information and demographics
  - Career interests and goals
  - Engineering specializations (if applicable)
  - Activity preferences
  - Religious affiliations
  - Primary goals for joining organizations

- **AI-Powered Recommendations**: 
  - Weighted text matching algorithm ranks organizations by relevance
  - Top 20 recommendations displayed with similarity scores
  - Filters out organizations the student has already joined
  - Eligibility-based filtering ensures only accessible organizations are shown

- **User Dashboard**:
  - View personalized organization recommendations
  - See similarity scores and organization details
  - Join organizations directly from recommendations
  - Track joined organizations
  - Real-time updates when recommendations change

- **Profile Management**:
  - Upload and manage profile pictures (stored in Supabase Storage)
  - Update name and email preferences
  - Reset survey responses to get new recommendations
  - Email preference controls (marketing, updates, recommendations)

- **Real-time Synchronization**:
  - Profile changes reflect immediately across sessions
  - Survey responses sync in real-time
  - Joined organizations update live
  - Recommendations refresh automatically

### For Organization Representatives

- **Organization Dashboard**:
  - Dedicated dashboard for managing organization information
  - Inline editing of organization details (bio, contact info, meeting times, etc.)
  - Update eligibility criteria and membership requirements
  - Real-time sync of changes across all connected clients

- **Account Setup Flow**:
  - Search and select organization during signup
  - Email verification required for account activation
  - Password setup via secure verification link
  - Automatic linking of account to organization

### Authentication & Security

- **Dual Login Flow**: Separate authentication flows for students and organization representatives
- **Email Verification**: Required for account activation
- **Password Reset**: Secure password reset flow with email verification
- **Resend Verification**: Ability to resend verification emails if not received
- **Rate Limiting**: API rate limiting to prevent abuse (30 searches/min, 5 submissions/hour)
- **Row Level Security (RLS)**: Supabase RLS policies for data protection
- **Input Validation**: XSS protection, honeypot fields, and input sanitization
- **Session Management**: Secure session handling with automatic token refresh

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: React Context API (AuthContext)
- **Image Optimization**: Next.js Image component

### Backend
- **API Routes**: Next.js API Routes (TypeScript)
- **Search Service**: Python Flask API (deployed on Render)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (profile pictures)
- **Real-time**: Supabase Realtime subscriptions

### Python Dependencies
- `pandas` - Data manipulation
- `numpy` - Numerical operations
- `sentence-transformers` - Text embeddings for matching
- `scikit-learn` - Machine learning utilities
- `flask` - API server framework
- `flask-cors` - CORS support
- `gunicorn` - Production WSGI server
- `supabase` - Supabase Python client

## Architecture

### System Architecture

```
┌─────────────────┐
│   Next.js App   │  (Vercel)
│   (Frontend)    │
└────────┬────────┘
         │
         ├──► Supabase (Database, Auth, Storage, Realtime)
         │
         └──► Python Flask API (Render)
                  │
                  └──► Weighted Search Algorithm
```

### Data Flow

1. **Student Registration** → Supabase Auth → Email Verification → Profile Creation
2. **Survey Submission** → API Route → Supabase (`user_queries` table) → Real-time Update
3. **Recommendations Request** → API Route → Python Search API → Weighted Matching → Filtered Results
4. **Organization Join** → API Route → Supabase (`user_joined_organizations`) → Real-time Update → Recommendations Refresh

### Key Components

- **AuthContext**: Central authentication provider with real-time subscriptions to user data
- **SurveyForm**: Multi-step survey component with form validation and animations
- **Dashboard**: Student dashboard displaying recommendations and joined organizations
- **Org Dashboard**: Organization management interface with inline editing
- **Middleware**: Route protection and authentication state management

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- Supabase account and project
- (Optional) Organization data CSV file (`final.csv`) for initial data import

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
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   SEARCH_API_URL=http://localhost:5000  # Optional: for local Python API
   ```

4. **Set up Supabase database**
   
   See [Database Setup](#database-setup) section below.

5. **Install Python dependencies**
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

7. **Run Python API server (optional, for local development)**
   ```bash
   python api_server.py
   ```

   The API will run on `http://localhost:5000` by default.

## Database Setup

### Step 1: Create Tables

Run these SQL scripts in your Supabase SQL Editor in order:

1. **`supabase_setup.sql`** - Creates `user_profiles` and `user_queries` tables
   - User profile information (name, picture, email preferences)
   - Survey responses and demographics
   - Row Level Security policies

2. **`supabase_organizations.sql`** - Creates `organizations` table
   - Organization information and details
   - Eligibility criteria (gender, race, classification, sexuality)
   - Meeting information and membership requirements

3. **`supabase_org_accounts.sql`** - Creates `org_accounts` table
   - Links Supabase auth users to organizations
   - Organization representative accounts

4. **`supabase_user_joined_orgs.sql`** - Creates `user_joined_organizations` table
   - Tracks which organizations students have joined
   - Enables filtering joined orgs from recommendations

### Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `profile-pictures`
3. Configure:
   - **Public bucket**: ✅ Enabled (for public image URLs)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

4. Set up storage policies (see `BACKEND_SETUP.md` for detailed SQL)

### Step 3: Import Organization Data

If you have a CSV file with organization data:

```bash
python scripts/migrate_csv_to_supabase.py
```

Or manually import through Supabase Dashboard → Table Editor → Import data.

### Step 4: Enable Real-time

Real-time subscriptions are automatically enabled for:
- `user_profiles`
- `user_queries`
- `user_joined_organizations`
- `organizations`

Verify in Supabase Dashboard → Database → Replication that these tables have replication enabled.

## API Documentation

### Student Endpoints

#### `POST /api/submit`
Submit survey responses and demographics.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@tamu.edu",
  "query": "cleansed query string",
  "cleansedQuery": "processed query",
  "gender": "Male",
  "race": "Asian",
  "classification": "Sophomore",
  "careerFields": ["Engineering", "Technology"],
  ...
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Rate Limit**: 5 requests per hour per IP

#### `GET /api/recommendations`
Get personalized organization recommendations.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "recommendations": [
    {
      "id": "uuid",
      "name": "Organization Name",
      "bio": "...",
      "similarity_score": 0.85,
      ...
    }
  ]
}
```

#### `POST /api/search`
Search organizations by query string.

**Request:**
```json
{
  "query": "engineering robotics",
  "userData": {
    "gender": "Male",
    "classification": "Sophomore",
    ...
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Organization Name",
      "similarity_score": 0.92,
      ...
    }
  ]
}
```

**Rate Limit**: 30 requests per minute per IP

#### `GET /api/profile`
Get user profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

#### `PUT /api/profile`
Update user profile.

**Request:**
```json
{
  "name": "John Doe",
  "email_preferences": {
    "marketing": true,
    "updates": true,
    "recommendations": true
  }
}
```

#### `POST /api/profile/upload`
Upload profile picture.

**Request:** FormData with `file` field

**Response:**
```json
{
  "url": "https://...supabase.co/storage/.../profile-picture.jpg"
}
```

#### `POST /api/reset-profile`
Reset user survey responses to get new recommendations.

### Organization Endpoints

#### `POST /api/org/signup`
Create organization account.

#### `POST /api/org/login`
Organization login helper.

#### `POST /api/org/check-account`
Check if organization account exists.

#### `POST /api/org/send-setup-link`
Send organization setup link via email.

#### `POST /api/org/complete-setup`
Complete organization account setup.

#### `POST /api/org/verify-request`
Verify organization account request.

### Authentication Endpoints

#### `POST /api/resend-verification`
Resend email verification.

## Deployment

### Frontend (Vercel)

1. **Connect repository to Vercel**
   - Import your Git repository
   - Vercel will auto-detect Next.js

2. **Configure environment variables** in Vercel Dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL
   SEARCH_API_URL
   ```

3. **Deploy**
   ```bash
   npm run build  # Test build locally first
   ```

   Vercel will automatically deploy on push to main branch.

### Python API (Render)

1. **Create a new Web Service** on Render

2. **Configure build and start commands**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn api_server:app --bind 0.0.0.0:$PORT`

3. **Set environment variables**:
   ```
   SUPABASE_URL
   SUPABASE_SERVICE_KEY
   USE_SUPABASE=true
   PORT=5000
   ```

4. **Update Vercel environment** with Render service URL:
   ```
   SEARCH_API_URL=https://your-render-service.onrender.com
   ```

### Alternative: Local Python API

For local development, you can run the Python API locally:

```bash
python api_server.py
```

Set `SEARCH_API_URL=http://localhost:5000` in your `.env.local`.

## Development

### Project Structure

```
organizeSurvey/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── org/                  # Organization endpoints
│   │   ├── profile/              # Profile management
│   │   ├── recommendations/      # Recommendations API
│   │   ├── search/               # Search API
│   │   └── submit/               # Survey submission
│   ├── auth/                     # Authentication pages
│   ├── dashboard/                # Student dashboard
│   ├── org/                      # Organization pages
│   ├── profile/                  # Profile settings
│   ├── survey/                   # Survey form
│   └── layout.tsx                # Root layout
├── components/
│   └── SurveyForm.tsx            # Multi-step survey component
├── contexts/
│   └── AuthContext.tsx           # Auth state & real-time subscriptions
├── lib/
│   ├── rateLimit.ts              # Rate limiting utility
│   └── supabase.ts               # Supabase client configuration
├── scripts/
│   ├── migrate_csv_to_supabase.py  # CSV import script
│   └── weighted_search.py        # Matching algorithm
├── api_server.py                 # Python Flask API server
├── middleware.ts                 # Route protection middleware
├── supabase_*.sql                # Database setup scripts
└── requirements.txt              # Python dependencies
```

### Key Development Files

- **`middleware.ts`**: Handles route protection and authentication redirects
- **`contexts/AuthContext.tsx`**: Central auth provider with real-time subscriptions
- **`lib/supabase.ts`**: Supabase client configuration (browser and server)
- **`scripts/weighted_search.py`**: Core matching algorithm using sentence transformers
- **`api_server.py`**: Python Flask API for organization search

### Running Tests

```bash
npm run lint        # Run ESLint
npm run build       # Test production build
```

### Database Migrations

When making schema changes:

1. Update the relevant SQL file (`supabase_*.sql`)
2. Run the SQL in Supabase SQL Editor
3. Update TypeScript types if needed
4. Test the changes locally

### Real-time Development

The app uses Supabase Realtime for live updates. To test:

1. Open the app in multiple browser windows
2. Make changes in one window
3. Verify updates appear in other windows automatically

## Security

### Authentication
- Supabase Auth handles user authentication
- JWT tokens with automatic refresh
- Email verification required for account activation
- Secure password reset flow

### Data Protection
- Row Level Security (RLS) policies on all tables
- Users can only access their own data
- Service role key only used server-side
- Input validation and sanitization on all API endpoints

### Rate Limiting
- Search API: 30 requests per minute per IP
- Survey submission: 5 requests per hour per IP
- In-memory rate limiting (resets on server restart)

### Input Validation
- XSS protection (script tag detection)
- Honeypot fields for bot detection
- Email format validation
- Length limits on all text inputs
- SQL injection prevention via Supabase parameterized queries

### Storage Security
- Profile pictures stored in Supabase Storage
- Storage policies restrict uploads to authenticated users
- File type and size validation
- Public read access for profile pictures

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow TypeScript best practices
   - Add comments for complex logic
   - Update documentation if needed

4. **Test thoroughly**
   - Test in development mode
   - Verify real-time updates work
   - Test authentication flows
   - Check rate limiting

5. **Submit a pull request**
   - Provide clear description of changes
   - Reference any related issues
   - Ensure all tests pass

### Code Style

- Use TypeScript for all new code
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Prefer functional components with hooks
- Use `useAuth()` hook for authentication state

### Database Changes

- Always update SQL setup scripts
- Document schema changes in PR description
- Test migrations on a development database first
- Update TypeScript types if schema changes

## License

This project is private and intended for Texas A&M University use.

## Support

For issues or questions:
1. Check existing documentation
2. Review Supabase logs for errors
3. Check browser console for client-side errors
4. Review API route logs in Vercel/Render

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Framer Motion Documentation](https://www.framer.com/motion/)
