import { auth } from '@/app/(auth)/auth';
import { addBackgroundTask } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

export async function POST(request: Request) {
  const {
    type,
    payload
  }: { type: 'snipeMemeCoins', payload: string } =
    await request.json();

  if (!payload || !type) {
    return new Response('payload and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  await addBackgroundTask({
    id: generateUUID(),
    createdAt: new Date(),
    type,
    payload,
    userId: session.user.id
  });

  return new Response('Background task added', { status: 200 });
}
