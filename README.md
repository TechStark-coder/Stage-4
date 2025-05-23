
# HomieStan - Your Home, Analyzed

This is a NextJS starter application for HomieStan, built in Firebase Studio. It allows users to manage homes and rooms, and use AI to analyze objects within those rooms from uploaded or captured images.

To get started, take a look at `src/app/page.tsx`.

## Features
- User Authentication (Login/Signup)
- Home and Room Management
- Image Upload (File Picker, Drag & Drop, Camera Capture) for Rooms
- AI-Powered Object Analysis from Room Images
- PDF Download of Analysis Results
- Firebase Firestore for Data Storage
- Firebase Storage for Image Storage
- Genkit for AI Flow
- Next.js App Router
- ShadCN UI Components
- Tailwind CSS

## Environment Variables
Ensure you have a `.env` file in the root of your project with your Firebase project configuration and Google API Key for Genkit:

```
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY_FOR_GENKIT
```
Replace `YOUR_...` placeholders with your actual credentials.

## Getting Started

### Prerequisites
- Node.js (version recommended by Next.js)
- npm or yarn
- Firebase Project (with Authentication, Firestore, and Storage enabled & configured)
- Google Cloud Project with Gemini API enabled for Genkit

### Setup
1. Clone the repository.
2. Install dependencies: `npm install` or `yarn install`.
3. Create a `.env` file in the project root and populate it with your Firebase and Google API keys (see "Environment Variables" section above).
4. Configure Firebase Storage:
    - Ensure your Firebase project is on the Blaze (pay-as-you-go) plan.
    - Enable Storage in the Firebase console.
    - Set up CORS rules for your Storage bucket to allow requests from your development and production origins.
    - Set up Firebase Storage Security Rules to allow authenticated users to read/write files.
5. Run the Genkit development server (if using local Genkit flows, optional if using cloud-deployed flows): `npm run genkit:dev`
6. Run the Next.js development server: `npm run dev`

The application should now be running, typically on `http://localhost:9002` (or your configured port).
```