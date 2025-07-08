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
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: {schema: DescribeRoomObjectsFromVideoInputSchema},
  output: {schema: DescribeRoomObjectsOutputSchema},
  prompt: `Analyze the provided video of a room to identify and count distinct objects.

Follow these rules precisely:
1.  **Identify & Count:** List each distinct type of object and its total count. For example, if you see three identical chairs, return { "name": "chair", "count": 3 }.
2.  **Be Specific:** If an object's brand, character, or title is clear (e.g., "Batman Funko Pop"), use that specific name. Otherwise, use a descriptive name (e.g., "blue coffee mug").
3.  **Differentiate:** Group identical items, but list visually distinct items separately. For example, one red chair and two blue chairs are two separate entries: { "name": "red chair", "count": 1 } and { "name": "blue chair", "count": 2 }.
4.  **Strictly Exclude:** You MUST NOT include common structural elements like 'walls', 'floors', 'ceilings', 'windows', 'doors', 'cabinets', or any of their parts (e.g., 'door knobs', 'light switches', 'baseboards'). Also, do not list 'cables' or 'wires'.

Your output must be ONLY the JSON object, structured exactly like this: { "objects": [ { "name": "object_name_1", "count": N1 }, ... ] }.

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
