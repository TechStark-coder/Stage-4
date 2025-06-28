
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
  tenantPhotoDataUris: z
    .array(
      z
        .string()
        .describe(
          "A photo of the room taken by the tenant, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        )
    )
    .describe('An array of photos of the room taken by the tenant.'),
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
2. A new set of 'tenantPhotos' of the same room, taken by a tenant or inspector.

Your task is to:
A. **VERY IMPORTANT FIRST STEP: Meticulously analyze ONLY the 'tenantPhotos' to create a detailed, independent inventory of all distinct objects and their counts visible in them.** Be very specific with names (e.g., "red leather armchair", "Samsung 55-inch TV"). When creating this inventory, you must strictly follow these exclusion rules:
    *   **DO NOT INCLUDE:** 'WALL', 'FLOOR', 'CEILING', 'WINDOW', 'DOOR', or 'CABINETS' as items.
    *   **ALSO EXCLUDE THEIR PARTS:** This exclusion also applies to all parts of these structures, such as 'door knobs', 'hinges', 'window frames', 'light switches', 'power outlets', 'baseboards', or 'cabinet handles'.
    *   Focus ONLY on movable objects, furniture, electronics, decorations, and personal belongings.
    *   Perform this inventory BEFORE looking at the 'expectedItems' list.

B. **Compare your detailed inventory from the 'tenantPhotos' (from step A) against the provided 'expectedItems' list.**

C. **Create a list of 'discrepancies'.** This list must ONLY contain items where the count you found is LESS THAN the expected count, or the item is completely missing (actual count is 0). For each such item, include its name, the expectedCount, the actualCount you found (which will be less than expected), and a brief 'note'. **DO NOT include items in the 'discrepancies' list if their count matches or exceeds the expectation.**

D. **If there are discrepancies, especially if an item is completely missing or its count is significantly lower, formulate a single, polite 'missingItemSuggestion' string.** This suggestion should prompt the user to re-check for ONE SPECIFIC, clearly named item that seems to be missing or significantly undercounted from the 'expectedItems' list. For example: "The 'vintage wooden clock' seems to be missing. Could you please take another picture focusing on where it should be?" If multiple items are problematic, choose one prominent or high-value sounding item for the suggestion. If all items match the expected counts or if discrepancies are very minor (e.g., many items and only one is off by a small count), this 'missingItemSuggestion' can be an empty string or a very mild, general prompt like "Looks mostly good, but you might want to double-check the smaller items."

Expected Items (provided by owner):
{{#if expectedItems.length}}
{{#each expectedItems}}
- "{{name}}" (Expected count: {{count}})
{{/each}}
{{else}}
- No specific items were pre-listed as expected by the owner for this room. In this case, for step C, the 'discrepancies' list will be empty, and for step D, the 'missingItemSuggestion' should be a general statement like "No owner list to compare against. Please review the items you see." Your primary task is then to list what you see based on the tenant photo.
{{/if}}

Tenant Photos to analyze:
{{#each tenantPhotoDataUris}}
{{media url=this}}
{{/each}}

Respond ONLY with a JSON object structured exactly according to the output schema. Ensure 'actualCount' reflects what you found in the tenant's photos.
`,
});

const identifyDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'identifyDiscrepanciesFlow',
    inputSchema: IdentifyDiscrepanciesInputSchema,
    outputSchema: IdentifyDiscrepanciesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
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
