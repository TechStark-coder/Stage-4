
import { config } from 'dotenv';
config();

import '@/ai/flows/describe-room-objects.ts';
import '@/ai/flows/identify-discrepancies-flow.ts';
import '@/ai/flows/describe-room-objects-from-video.ts'; // Added new flow

