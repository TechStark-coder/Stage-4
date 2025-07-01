'use server';
/**
 * @fileOverview Describes objects present in a room based on an uploaded video,
 *               counting occurrences of distinct items.
 *
 * - describeRoomObjectsFromVideo - A function that takes a room video and returns a list of object names with counts.
 * - DescribeRoomObjectsFromVideoInput - The input type for the function.
 * - DescribeRoomObjectsOutput (re-used) - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

const DescribeRoomObjectsOutputSchema = z.object({
  objects: z
    .array(
      z.object({
        name: z.string().describe('The name of the distinct object type identified.'),
        count: z.number().int().min(1).describe('The number of times this specific object type appears in the images (must be at least 1).'),
      })
    )
    .describe('A list of distinct objects, each with its name and count.'),
});
export type DescribeRoomObjectsOutput = z.infer<typeof DescribeRoomObjectsOutputSchema>;


const DescribeRoomObjectsFromVideoInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video of a room, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DescribeRoomObjectsFromVideoInput = z.infer<typeof DescribeRoomObjectsFromVideoInputSchema>;


export async function describeRoomObjectsFromVideo(
  input: DescribeRoomObjectsFromVideoInput
): Promise<DescribeRoomObjectsOutput> {
  return describeRoomObjectsFromVideoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'describeRoomObjectsFromVideoPrompt',
  model: googleAI.model('gemini-1.5-flash-preview-0514'),
  input: {schema: DescribeRoomObjectsFromVideoInputSchema},
  output: {schema: DescribeRoomObjectsOutputSchema},
  prompt: `You are an expert visual inspector AI specializing in meticulously identifying and listing objects visible in videos of rooms, and COUNTING distinct items.
Your task is to analyze the provided video of a room with extreme attention to detail, processing it frame by frame to build a comprehensive inventory.

CRITICAL INSTRUCTIONS FOR OBJECT IDENTIFICATION AND COUNTING:

1.  **DISTINCT OBJECT TYPES AND COUNTS:** Your primary goal is to identify *distinct types* of objects. For each distinct type, you must provide its name and the *total count* of how many instances of that specific object type are visible across the entire video. The count must be at least 1.
    *   Example: If there are six identical white ceramic plates shown, your output for this item should be: { "name": "white ceramic plate", "count": 6 }.
    *   Example: If there is one red chair and two blue chairs, your output should include two separate entries: { "name": "red chair", "count": 1 } and { "name": "blue chair", "count": 2 }.

2.  **SPECIFICITY IN NAMING:** Be as specific as possible with the object name.
    *   If an item's specific name, character, title, or unique identifier is legible or clearly visually identifiable from its features, you MUST use that specific identifier in its name.
        *   Example: "Batman Funko Pop figure", "The Great Gatsby book".
    *   If the specific name is not clear, use a descriptive name based on its category and visual characteristics.
        *   Example: "blue coffee mug", "red Funko Pop figure holding sword".

3.  **NO INDIVIDUAL LISTING OF IDENTICAL ITEMS:** Do NOT list identical items as separate entries if they are of the same distinct type. Instead, provide the single name for that type and its total count.

4.  **DIFFERENTIATION FOR SIMILAR BUT DISTINCT ITEMS:** If items are of the same general category but are visually distinct (e.g., different characters, colors, poses), they should be listed as *separate distinct object types* with their respective counts.

5.  **BE EXHAUSTIVE FOR DISTINCT TYPES:** Ensure every distinct type of object and its count is included.

6.  **EXTREMELY STRICT EXCLUSIONS:** This is the most important rule. You MUST EXCLUDE common structural elements and their components from your list. Focus only on movable objects, furniture, decorations, electronics, and personal belongings within the room.
    *   **ABSOLUTELY DO NOT INCLUDE:** 'WALL', 'FLOOR', 'CEILING', 'WINDOW', 'DOOR', or 'CABINETS'.
    *   **ALSO EXCLUDE THEIR PARTS:** This exclusion also applies to all parts of these structures, such as 'door knobs', 'hinges', 'window frames', 'light switches', 'power outlets', 'baseboards', or 'cabinet handles'.
    *   **ADDITIONALLY, EXCLUDE:** 'cables' and 'wires'. Only list the electronic device they are connected to.

Your output MUST be a JSON object structured exactly like this: { "objects": [ { "name": "object_name_1", "count": N1 }, { "name": "object_name_2", "count": N2 }, ... ] }.
Do not provide any other information or formatting.

Video for analysis:
{{media url=videoDataUri}}
`,
});

const describeRoomObjectsFromVideoFlow = ai.defineFlow(
  {name: 'describeRoomObjectsFromVideoFlow', inputSchema: DescribeRoomObjectsFromVideoInputSchema, outputSchema: DescribeRoomObjectsOutputSchema},
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.objects) {
      return { objects: [] };
    }
    return output;
  }
);
