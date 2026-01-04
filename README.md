# TAMU Survey - Next.js Project

A survey application for Texas A&M University built with Next.js, TypeScript, Tailwind CSS, and Framer Motion. This application uses weighted text matching to match students with relevant organizations based on their survey responses.

## Features

- Multi-step survey form with smooth animations
- TAMU color theme (maroon and white)
- Interactive form elements with Framer Motion animations
- Weighted text matching for organization recommendations
- Eligibility filtering based on demographics (gender, race, classification, sexuality)
- Top 20 organization recommendations with similarity scores
- Responsive design

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- `final.csv` file in the project root
- Supabase project (for authentication and data storage)

## Getting Started

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [Supabase Console](https://supabase.com/)
2. Create a `.env.local` file in the project root with your Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

You can find these values in your Supabase project settings under "API" > "Project API keys".

3. Set up the `user_queries` table in your Supabase SQL Editor (create the table schema as needed for your application).

### 3. Install Python Dependencies

Create a virtual environment and install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The API route will automatically use the virtual environment's Python if it exists.

### 4. Add Organizations CSV

Place your `final.csv` file in the project root directory.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the survey.

## Survey Questions

1. **Contact Information** - Name and email (required)
2. Career fields of interest (multiple selection)
3. On-campus housing status and hall name
4. Classification (Freshman, Sophomore, Junior, Senior, Graduate)
5. Demographics (Race, Sexuality, Gender, Hobbies)
6. Activities and goals (Activity preferences, Religious organizations, Primary goal)

## How It Works

1. User enters their name and email (required)
2. User completes the multi-step survey
3. Survey responses are cleansed and combined into a query string
4. The query is sent to the `/api/search` endpoint
5. The API calls a Python script that:
   - Loads and processes the organizations CSV
   - Performs weighted text matching based on user preferences
   - Filters organizations based on eligibility criteria (gender, race, classification, sexuality)
   - Returns the top matching organizations
6. Results are displayed to the user with similarity scores and organization details
7. Submission data (name, email, survey responses, and top results) is automatically saved to Supabase

## Eligibility Filtering

The system automatically filters out organizations that the user is not eligible for based on:
- **Gender**: Organizations with gender-specific requirements (e.g., "Women in Engineering", "Male-only" groups)
- **Race**: Organizations with race-specific eligibility requirements
- **Classification**: Organizations that require specific academic classifications
- **Sexuality**: Organizations with sexuality-specific requirements

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase - for authentication and data storage
- Python 3.8+
- pandas

## Project Structure

```
organizeSurvey/
├── app/
│   ├── api/
│   │   ├── search/
│   │   │   └── route.ts          # API endpoint for organization search
│   │   ├── submit/
│   │   │   └── route.ts           # API endpoint to save submissions to Supabase
│   │   ├── profile/
│   │   │   └── route.ts           # API endpoint for user profile
│   │   └── reset-profile/
│   │       └── route.ts           # API endpoint to reset user profile
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── SurveyForm.tsx             # Main survey form component
├── lib/
│   ├── supabase.ts                # Supabase configuration
│   └── rateLimit.ts               # Rate limiting utility
├── scripts/
│   └── weighted_search.py         # Python script for weighted search and filtering
├── final.csv                      # Organizations data (add this file)
├── .env.local                     # Supabase configuration (create this file)
└── requirements.txt               # Python dependencies
```

## Supabase Data Structure

The application stores data in Supabase with the following tables:

- **`user_queries`**: Stores user survey queries and demographics
- **`profiles`**: User profile information (managed by Supabase Auth)

## Notes

- Make sure `final.csv` is in the project root directory
- Make sure `.env.local` is configured with your Supabase credentials
- The search uses weighted text matching for organization recommendations
