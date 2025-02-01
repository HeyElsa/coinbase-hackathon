import { generateUUID } from '@/lib/utils';
import { tool } from 'ai';
import { z } from 'zod';

export const snipeMemeCoins = tool({
  description: 'Use spend permissions and register a background action to snipe meme coins as they drop',
  parameters: z.object({
    budget: z.number(),
  }),
  execute: async ({ budget } : { budget : number }) => {
    const requestId = generateUUID();
    return {
        budget,
        requestId,
    };
  },
});
