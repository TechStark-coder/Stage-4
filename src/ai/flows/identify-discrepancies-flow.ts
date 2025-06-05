
'use server';
/**
 * @fileOverview Identifies discrepancies between expected items in a room and items found in a tenant's photo.
 *
 * - identifyDiscrepancies - A function that takes a tenant's photo and a list of expected items,
 *                           then returns a list of discrepancies and a suggestion for the user.
 * - IdentifyDiscrepanciesInput - The input type for the identifyDiscrepancies function.
 * - IdentifyDiscrepanciesOutput - The return type for the identifyDiscrepancies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpectedItemSchema = z.object({
  name: z.string().describe('The name of the expected item.'),
  count: z.number().int().positive().describe('The expected count of this item.'),
});

// REMOVED export from the line below
const IdentifyDiscrepanciesInputSchema = z.object({
  tenantPhotoDataUri: z
    .string()
    .describe(
      "A photo of the room taken by the tenant, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  expectedItems: z
    .array(ExpectedItemSchema)
    .describe('A list of items expected to be in the room, with their names and counts, based on owner initial analysis.'),
});
export type IdentifyDiscrepanciesInput = z.infer<typeof IdentifyDiscrepanciesInputSchema>;

// REMOVED export from the line below
const IdentifyDiscrepanciesOutputSchema = z.object({
  discrepancies: z
    .array(
      z.object({
        name: z.string().describe('The name of the item with a discrepancy.'),
        expectedCount: z.number().int().describe('The count of this item expected by the owner.'),
        actualCount: z.number().int().describe('The count of this item identified in the tenant photo.'),
        note: z.string().describe('A brief note about the discrepancy (e.g., "Missing", "Less than expected").'),
      })
    )
    .describe('A list of items that are missing or have incorrect counts in the tenant photo compared to expectations.'),
  missingItemSuggestion: z
    .string()
    .describe(
      "A polite, natural language suggestion for the user if a specific item seems notably missing or undercounted. Empty if no strong suggestion is warranted."
    ),
});
export type IdentifyDiscrepanciesOutput = z.infer<typeof IdentifyDiscrepanciesOutputSchema>;


export async function identifyDiscrepancies(
  input: IdentifyDiscrepanciesInput
): Promise<IdentifyDiscrepanciesOutput> {
  return identifyDiscrepanciesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyDiscrepanciesPrompt',
  input: {schema: IdentifyDiscrepanciesInputSchema},
  output: {schema: IdentifyDiscrepanciesOutputSchema},
  prompt: `You are an advanced inventory and discrepancy detection AI.
You will be given:
1. A list of 'expectedItems' with their names and expected counts, which were identified from a reference image of a room by the homeowner.
2. A new 'tenantPhoto' of the same room, taken by a tenant or inspector.

Your task is to:
A. Meticulously analyze the 'tenantPhoto' to identify all distinct objects and their counts. Be very specific with names. Exclude common structural elements like walls, floors, ceilings, windows, and doors unless they have distinct decorative features.
B. Compare the objects you found in 'tenantPhoto' against the 'expectedItems' list.
C. Create a list of 'discrepancies'. For each item in 'expectedItems' that is either entirely missing from 'tenantPhoto' or present in a lesser quantity than expected, list it as a discrepancy. Include its name, the original expectedCount, the actualCount you found in 'tenantPhoto', and a brief 'note' (e.g., "Completely missing", "1 of 3 found", "2 less than expected"). If an expected item is found with the correct or higher count, do NOT list it as a discrepancy.
D. If there are discrepancies, especially if an item is completely missing or its count is significantly lower, formulate a single, polite 'missingItemSuggestion' string. This suggestion should prompt the user to re-check for ONE SPECIFIC, clearly named item that seems to be missing or significantly undercounted. For example: "The 'vintage wooden clock' seems to be missing. Could you please take another picture focusing on where it should be?" If multiple items are problematic, choose one prominent or high-value sounding item for the suggestion. If all items match the expected counts or if discrepancies are very minor (e.g., many items and only one is off by a small count), this 'missingItemSuggestion' can be an empty string or a very mild, general prompt like "Looks mostly good, but you might want to double-check the smaller items."

Expected Items:
{{#if expectedItems.length}}
{{#each expectedItems}}
- "{{name}}" (Expected count: {{count}})
{{/each}}
{{else}}
- No specific items were pre-listed as expected by the owner for this room. Please identify all objects you see.
{{/if}}

Tenant Photo:
{{media url=tenantPhotoDataUri}}

Respond ONLY with a JSON object structured exactly according to the output schema. Ensure 'actualCount' reflects what you found in the tenant's photo.
`,
});

const identifyDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'identifyDiscrepanciesFlow',
    inputSchema: IdentifyDiscrepanciesInputSchema,
    outputSchema: IdentifyDiscrepanciesOutputSchema,
  },
  async (input) => {
    // If no expected items were provided by the owner, the AI's primary job is just to list what it sees.
    // In this scenario, discrepancies and suggestions might be minimal unless the prompt handles it.
    // The current prompt handles this by asking the AI to just list items if expectedItems is empty.
    // For the output schema, we might return empty discrepancies and suggestion in such a case post-AI call, or let AI do its best.
    // For now, let the AI attempt to populate based on the prompt's conditional logic.

    const {output} = await prompt(input);
    if (!output) {
      // This case should ideally be handled by Genkit if the schema isn't met,
      // but as a fallback:
      return {
        discrepancies: [],
        missingItemSuggestion: "Could not analyze the image properly. Please try again.",
      };
    }
    return output;
  }
);

// Add this flow to dev.ts
// import '@/ai/flows/identify-discrepancies-flow.ts';

