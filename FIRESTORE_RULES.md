# Firestore Security Rules Setup

## Quick Setup for Testing

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **tamusurvey-5795b**
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab (next to Data, Indexes, etc.)
5. Replace the existing rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads and writes for testing
    // ⚠️ WARNING: This is only for development/testing!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. Click **Publish** to save the rules

## What This Does

- Allows all reads and writes to Firestore
- This is ONLY for development/testing
- For production, you'll need proper authentication and security rules

## After Setting Rules

1. Wait a few seconds for rules to propagate
2. Restart your dev server
3. Submit a test form
4. Check Firestore Database → Data tab
5. You should see collections: `submissions`, `users`, and `stats`

