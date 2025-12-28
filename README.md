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

## Getting Started

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Install Python Dependencies

Create a virtual environment and install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The API route will automatically use the virtual environment's Python if it exists.

### 3. Generate Embeddings (One-time setup)

Generate the embeddings file for fast searches:

```bash
source venv/bin/activate
python3 scripts/generate_embeddings.py organizations_detailed.csv
```

This will create `organizations_embeddings.pkl` in the project root. This file is required for searches to work quickly. The first generation takes a few minutes, but all subsequent searches will be fast (~1-2 seconds).

### 3. Add Organizations CSV

Place your `organizations_detailed.csv` file in the project root directory.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the survey.

## Survey Questions

1. Career fields of interest (multiple selection)
2. On-campus housing status and hall name
3. Classification (Freshman, Sophomore, Junior, Senior, Graduate)
4. Demographics (Race, Sexuality, Gender, Hobbies)
5. Activities and goals (Activity preferences, Religious organizations, Primary goal)

## How It Works

1. User completes the multi-step survey
2. Survey responses are cleansed and combined into a query string
3. The query is sent to the `/api/search` endpoint
4. The API calls a Python script that:
   - Loads and processes the organizations CSV
   - Generates vector embeddings for all organizations using sentence transformers
   - Generates an embedding for the user's query
   - Calculates cosine similarity scores
   - Filters organizations based on eligibility criteria (gender, race, classification, sexuality)
   - Returns the top 20 matching organizations
5. Results are displayed to the user with similarity scores and organization details

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
- Python 3.8+
- sentence-transformers (all-MiniLM-L6-v2 model)
- pandas
- scikit-learn

## Project Structure

```
organizeSurvey/
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts          # API endpoint for organization search
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── SurveyForm.tsx             # Main survey form component
├── scripts/
│   └── vector_search.py          # Python script for vector search and filtering
├── organizations_detailed.csv     # Organizations data (add this file)
└── requirements.txt               # Python dependencies
```

## Notes

- The first search may take longer as the sentence transformer model needs to be downloaded
- Embeddings are regenerated on each search (consider caching for production)
- Make sure `organizations_detailed.csv` is in the project root directory
