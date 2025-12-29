# TAMU Survey - Next.js Project

A survey application for Texas A&M University built with Next.js, TypeScript, Tailwind CSS, and Framer Motion. This application uses vector embeddings and semantic search to match students with relevant organizations based on their survey responses.

## Features

- Multi-step survey form with smooth animations
- TAMU color theme (maroon and white)
- Interactive form elements with Framer Motion animations
- Vector-based semantic search using sentence transformers
- Eligibility filtering based on demographics (gender, race, classification, sexuality)
- Top 20 organization recommendations with similarity scores
- Responsive design

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+ with pip
- `organizations_detailed.csv` file in the project root
- Firebase project (for data collection)

## Getting Started

### 1. Install Node.js Dependencies

```bash
npm install
```

This will install Firebase SDK along with other dependencies.

### 2. Set Up Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database in your Firebase project
3. Create a `.env.local` file in the project root with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

You can find these values in your Firebase project settings under "General" > "Your apps" > "Web app" configuration.

4. Set up Firestore security rules (for development, you can use test mode, but for production, set up proper rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**Note:** The above rule is for testing only. For production, implement proper authentication and security rules.

### 3. Install Python Dependencies

Create a virtual environment and install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The API route will automatically use the virtual environment's Python if it exists.

### 4. Generate Embeddings (One-time setup)

Generate the embeddings file for fast searches:

```bash
source venv/bin/activate
python3 scripts/generate_embeddings.py organizations_detailed.csv
```

This will create `organizations_embeddings.pkl` in the project root. This file is required for searches to work quickly. The first generation takes a few minutes, but all subsequent searches will be fast (~1-2 seconds).

### 5. Add Organizations CSV

Place your `organizations_detailed.csv` file in the project root directory.

### 6. Run the Development Server

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
   - Generates vector embeddings for all organizations using sentence transformers
   - Generates an embedding for the user's query
   - Calculates cosine similarity scores
   - Filters organizations based on eligibility criteria (gender, race, classification, sexuality)
   - Returns the top 20 matching organizations
6. Results are displayed to the user with similarity scores and organization details
7. Submission data (name, email, survey responses, and top results) is automatically saved to Firebase
8. Statistics (total submissions and unique users) are tracked and displayed in the header

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
- Firebase (Firestore) - for data collection and analytics
- Python 3.8+
- sentence-transformers (all-MiniLM-L6-v2 model)
- pandas
- scikit-learn

## Project Structure

```
organizeSurvey/
├── app/
│   ├── api/
│   │   ├── search/
│   │   │   └── route.ts          # API endpoint for organization search
│   │   ├── submit/
│   │   │   └── route.ts           # API endpoint to save submissions to Firebase
│   │   └── stats/
│   │       └── route.ts           # API endpoint to get submission statistics
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── SurveyForm.tsx             # Main survey form component
├── lib/
│   └── firebase.ts                # Firebase configuration
├── scripts/
│   └── weighted_search.py         # Python script for weighted search and filtering
├── organizations_detailed.csv     # Organizations data (add this file)
├── .env.local                     # Firebase configuration (create this file)
└── requirements.txt               # Python dependencies
```

## Firebase Data Structure

The application stores data in Firestore with the following collections:

- **`submissions`**: Each survey submission with name, email, survey data, and search results
- **`users`**: User records tracking email, name, submission count, and timestamps
- **`stats`**: Global statistics document with total submissions and unique user count

## Notes

- The first search may take longer as the sentence transformer model needs to be downloaded
- Embeddings are regenerated on each search (consider caching for production)
- Make sure `organizations_detailed.csv` is in the project root directory
- Make sure `.env.local` is configured with your Firebase credentials
- Statistics are displayed in the header showing total submissions and unique users
- Each user's email is normalized (lowercase) to track unique users accurately
