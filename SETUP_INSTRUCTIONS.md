# Firebase Setup Instructions

Follow these steps to complete the Firebase integration:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter a project name (e.g., "tamu-survey")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Firestore Database

1. In your Firebase project, click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" (for development) or "Start in production mode" (for production)
4. Select a location for your database (choose the closest to your users)
5. Click "Enable"

**Important:** For production, you'll need to set up proper security rules. For now, test mode will work for development.

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. If you don't have a web app yet, click the `</>` icon to add one
5. Register your app with a nickname (e.g., "TAMU Survey Web")
6. Copy the configuration values

## Step 4: Create Environment File

1. In your project root directory, create a file named `.env.local`
2. Add the following content with your Firebase values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Replace the placeholder values with your actual Firebase configuration values.

**Example:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tamu-survey.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tamu-survey
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tamu-survey.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

## Step 5: Set Up Firestore Security Rules (For Production)

1. In Firebase Console, go to "Firestore Database" > "Rules"
2. For development/testing, you can use:

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

**⚠️ WARNING:** The above rule allows anyone to read/write until 2025. This is ONLY for testing!

3. For production, implement proper authentication and rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow reads of stats
    match /stats/{document} {
      allow read: if true;
      allow write: if false; // Only server can write
    }
    
    // Submissions - only server can write
    match /submissions/{submissionId} {
      allow read: if false; // Or implement proper auth
      allow write: if false; // Only server can write
    }
    
    // Users - only server can write
    match /users/{userId} {
      allow read: if false; // Or implement proper auth
      allow write: if false; // Only server can write
    }
  }
}
```

4. Click "Publish" to save the rules

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Fill out the survey form:
   - Enter your name and email
   - Complete all survey steps
   - Submit the form

4. Check Firebase Console:
   - Go to "Firestore Database"
   - You should see three collections:
     - `submissions` - Contains your survey submission
     - `users` - Contains user record
     - `stats` - Contains global statistics

5. Verify the data:
   - Check that your name, email, survey data, query info, and search results are stored
   - Check that stats show 1 total submission and 1 unique user

## Step 7: View Your Data

### In Firebase Console:

1. **View Submissions:**
   - Go to Firestore Database
   - Click on `submissions` collection
   - Click on a document to see:
     - Name and email
     - Complete survey data
     - Query information (original query, cleansed query, keywords, user data)
     - Search results (top 20 organizations)
     - Submission timestamp
     - Whether it was a new user

2. **View Users:**
   - Click on `users` collection
   - See user records with:
     - Email (normalized)
     - Name
     - First submission date
     - Last submission date
     - Submission count

3. **View Stats:**
   - Click on `stats` collection
   - Click on `global` document
   - See:
     - Total submissions count
     - Unique users count
     - Last updated timestamp

## Troubleshooting

### Error: "Firebase: Error (auth/configuration-not-found)"
- Make sure `.env.local` file exists in the project root
- Verify all environment variables are set correctly
- Restart your development server after creating/updating `.env.local`

### Error: "Firebase: Error (permission-denied)"
- Check your Firestore security rules
- For testing, use the test mode rules provided above
- Make sure rules are published

### No data appearing in Firebase
- Check browser console for errors
- Verify Firebase configuration values are correct
- Check that Firestore Database is enabled (not Realtime Database)
- Make sure you're looking at the correct Firebase project

### Stats not updating
- Stats are updated automatically when a submission is saved
- Check the browser console for any errors during submission
- Verify the `/api/submit` endpoint is working

## Next Steps After Setup

1. **Monitor Submissions:**
   - Regularly check the `submissions` collection in Firebase
   - Export data if needed for analysis

2. **Set Up Production Rules:**
   - Before going live, implement proper security rules
   - Consider adding authentication if needed
   - Set up proper access controls

3. **Backup Your Data:**
   - Set up regular exports from Firestore
   - Consider setting up automated backups

4. **Analytics (Optional):**
   - Set up Firebase Analytics to track user behavior
   - Create custom dashboards for survey insights

## Data Structure Reference

### Submissions Collection
```javascript
{
  name: "John Doe",
  email: "john@example.com",
  surveyData: { /* all survey responses */ },
  queryInfo: {
    originalQuery: "Career Fields...",
    cleansedQuery: "Engineering | Engineering | Engineering...",
    queryKeywords: ["Engineering", "Technology", ...],
    userDataForSearch: { /* user demographics */ }
  },
  searchResults: [ /* top 20 organizations */ ],
  submittedAt: Timestamp,
  isNewUser: true/false
}
```

### Users Collection
```javascript
{
  email: "john@example.com",
  name: "John Doe",
  firstSubmission: Timestamp,
  lastSubmission: Timestamp,
  submissionCount: 1
}
```

### Stats Collection (global document)
```javascript
{
  totalSubmissions: 100,
  uniqueUsers: 75,
  lastUpdated: Timestamp
}
```

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the terminal/console for server errors
3. Verify all environment variables are set correctly
4. Ensure Firestore is enabled and rules are published

