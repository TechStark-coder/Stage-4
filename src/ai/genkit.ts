import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// --- VITAL DIAGNOSTIC LOG ---
// This log helps confirm if the GOOGLE_API_KEY is being picked up by the Genkit environment.
// It's read from the environment where your Next.js server (and thus Genkit flows if running locally) executes.
if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY.includes("YOUR_") || process.env.GOOGLE_API_KEY.length < 10) {
  console.error(
    "\n******************************************************************************************\n" +
    "CRITICAL GENKIT CONFIG ERROR: Invalid or Missing GOOGLE_API_KEY for Genkit.\n" +
    "The GOOGLE_API_KEY from your .env (or .env.local, or server environment variables) is problematic.\n" +
    "Observed GOOGLE_API_KEY value (or undefined): '", process.env.GOOGLE_API_KEY, "'\n" +
    "Troubleshooting Steps:\n" +
    "1. Ensure .env (or .env.local) file exists in your project root if running locally.\n" +
    "2. Verify GOOGLE_API_KEY is correctly set to your *actual* Gemini API Key.\n" +
    "3. If deploying, ensure GOOGLE_API_KEY is set as an environment variable in your deployment environment.\n" +
    "4. IMPORTANT: You MUST RESTART your Next.js development server after editing .env files.\n" +
    "******************************************************************************************\n"
  );
} else {
  console.log("Genkit Initialization - GOOGLE_API_KEY seems to be set.");
}


export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash-preview-05-20',
});
