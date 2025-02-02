import { generateUUID } from '@/lib/utils';
import { tool } from 'ai';
import { z } from 'zod';

export const snipeMemeCoins = tool({
  description: 'Use spend permissions and register a background action to snipe meme coins as they drop',
  parameters: z.object({
    budget: z.number().max(0.001, 'Max allowed amount is 0.001 ETH as this is not production ready yet.'),
  }),
  execute: async ({ budget } : { budget : number }) => {
    const requestId = generateUUID();
    return {
        budget,
        requestId,
    };
  },
});
