
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage"; // Added FirebaseStorage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- VITAL DIAGNOSTIC LOG ---
// Check your browser's developer console for this output.
// This shows the exact configuration your Firebase app is trying to use.
console.log("Firebase Initialization - Attempting to use config:", firebaseConfig);

// Explicitly check if the API key is missing, a placeholder, or too short.
if (!firebaseConfig.apiKey || 
    firebaseConfig.apiKey === "YOUR_FIREBASE_API_KEY" || // Check for common placeholder
    firebaseConfig.apiKey.includes("YOUR_") || // Check for other placeholder patterns
    firebaseConfig.apiKey.length < 10) { // Basic sanity check for length
  console.error(
    "******************************************************************************************\n" +
    "CRITICAL FIREBASE CONFIG ERROR: Invalid or Missing API Key.\n" +
    "NEXT_PUBLIC_FIREBASE_API_KEY from your .env (or .env.local) file is problematic.\n" +
    "Observed apiKey value: '", firebaseConfig.apiKey, "'\n" +
    "Troubleshooting Steps:\n" +
    "1. Ensure .env (or .env.local) file exists in your project root.\n" +
    "2. Verify NEXT_PUBLIC_FIREBASE_API_KEY is correctly set to your *actual* Firebase project's Web API Key.\n" +
    "3. IMPORTANT: You MUST RESTART your Next.js development server after editing the .env file.\n" +
    "******************************************************************************************"
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage; // Added storage

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app); // Initialize storage

export { app, auth, db, storage }; // Export storage
