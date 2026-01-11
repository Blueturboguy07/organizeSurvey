# ORGanize TAMU

A full-stack web application that helps Texas A&M University students discover and connect with student organizations that match their interests. Built with Next.js, TypeScript, Tailwind CSS, Supabase, and Python.

## Features

### For Students
- **Multi-step Survey** - Interactive survey with smooth Framer Motion animations to capture interests, career goals, demographics, and preferences
- **AI-Powered Matching** - Weighted text matching algorithm to recommend organizations based on survey responses
- **Eligibility Filtering** - Automatic filtering based on demographics (gender, race, classification, sexuality)
- **User Dashboard** - Personal dashboard showing recommendations and organization matches
- **Profile Management** - Upload profile pictures, manage email preferences, and update personal info
- **Real-time Updates** - Live data synchronization across sessions using Supabase real-time subscriptions

### For Organization Representatives
- **Organization Dashboard** - Dedicated dashboard to manage organization information
- **Inline Editing** - Edit organization details (bio, contact info, meeting times, etc.) directly from the dashboard
- **Real-time Sync** - Changes sync instantly across all connected clients

### Authentication & Security
- **Dual Login Flow** - Separate authentication flows for students and organization representatives
- **Email Verification** - Email verification required for account activation
- **Resend Verification** - Ability to resend verification emails if not received
- **Password Reset** - Secure password reset flow
- **Rate Limiting** - API rate limiting to prevent abuse
- **Row Level Security (RLS)** - Supabase RLS policies for data protection

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Next.js API Routes, Python
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (profile pictures)
- **Real-time**: Supabase Realtime subscriptions

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- Supabase project
- Organization data CSV file (`final.csv`)

## Getting Started

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Run the SQL setup scripts in your Supabase SQL Editor:
   - `supabase_setup.sql` - User profiles table and policies
   - `supabase_organizations.sql` - Organizations table and policies
   - `supabase_org_accounts.sql` - Organization accounts table and policies

4. Create a storage bucket named `profile-pictures` in Supabase Storage

### 3. Install Python Dependencies

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Add Organizations Data

Place your `final.csv` file in the project root directory with organization data.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
organizeSurvey/
├── app/
│   ├── api/
│   │   ├── org/                    # Organization API endpoints
│   │   │   ├── check-account/      # Check if org account exists
│   │   │   ├── complete-setup/     # Complete org account setup
│   │   │   ├── login/              # Org login helper
│   │   │   ├── send-setup-link/    # Send setup link email
│   │   │   ├── signup/             # Org signup
│   │   │   └── verify-request/     # Verify org request
│   │   ├── profile/                # User profile endpoints
│   │   │   ├── route.ts            # GET/PUT profile
│   │   │   └── upload/             # Profile picture upload
│   │   ├── resend-verification/    # Resend verification email
│   │   ├── reset-profile/          # Reset user interests
│   │   ├── search/                 # Organization search
│   │   └── submit/                 # Submit survey responses
│   ├── auth/
│   │   ├── callback/               # Auth callback handler
│   │   └── verify/                 # Email verification page
│   ├── dashboard/                  # Student dashboard
│   ├── forgot-password/            # Password reset request
│   ├── login/                      # Login page (student & org)
│   ├── org/
│   │   ├── dashboard/              # Organization dashboard
│   │   └── setup/                  # Org account setup
│   ├── profile/                    # User profile settings
│   ├── register/                   # Student registration
│   ├── reset-password/             # Password reset form
│   ├── survey/                     # Survey form page
│   ├── globals.css                 # Global styles
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Landing page
├── components/
│   └── SurveyForm.tsx              # Multi-step survey component
├── contexts/
│   └── AuthContext.tsx             # Auth state & real-time subscriptions
├── lib/
│   ├── rateLimit.ts                # API rate limiting
│   └── supabase.ts                 # Supabase client configuration
├── scripts/
│   ├── migrate_csv_to_supabase.py  # Import CSV data to Supabase
│   └── weighted_search.py          # Organization matching algorithm
├── middleware.ts                   # Auth middleware
├── supabase_setup.sql              # User profiles SQL
├── supabase_organizations.sql      # Organizations SQL
├── supabase_org_accounts.sql       # Org accounts SQL
└── requirements.txt                # Python dependencies
```

## Database Schema

### Tables

- **`user_profiles`** - User profile data (name, picture, email preferences)
- **`user_queries`** - Survey responses and demographics
- **`organizations`** - Organization information and eligibility criteria
- **`org_accounts`** - Links Supabase auth users to organizations

## How It Works

### Student Flow
1. Student registers with TAMU email → receives verification email
2. After verification, completes multi-step survey
3. Survey responses are processed by weighted matching algorithm
4. Top 20 matching organizations displayed with similarity scores
5. Student can view recommendations from dashboard

### Organization Flow
1. Org representative selects their organization from search
2. If no account exists, creates one with org's contact email
3. Receives verification email → clicks link to set password
4. Accesses org dashboard to update organization information

### Matching Algorithm
The Python script (`weighted_search.py`):
1. Loads organization data from Supabase
2. Combines user responses into a query string
3. Performs weighted text matching based on preferences
4. Filters organizations by eligibility criteria
5. Returns top matching organizations with scores

## Real-time Features

The application uses Supabase Realtime for live updates:

- **Auth State** - Instant login/logout synchronization
- **User Profiles** - Profile changes reflect immediately
- **Survey Data** - Survey responses sync in real-time
- **Organizations** - Org updates propagate to all clients
- **Login Search** - Organization list updates live

## Deployment

### Vercel (Frontend)
```bash
npm run build
```

Deploy to Vercel with environment variables configured.

### Render (Python API)
Use `Procfile` and `render.yaml` for Render deployment.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | Application URL for email redirects |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and intended for Texas A&M University use.
