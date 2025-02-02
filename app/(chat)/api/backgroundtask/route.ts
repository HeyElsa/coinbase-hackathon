import { auth } from '@/app/(auth)/auth';
import { addBackgroundTask, getBackgroundTaskById } from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const backgroundTask = await getBackgroundTaskById({ id, userId: session.user.id! });
  if (!backgroundTask) {
    return new Response('Not found', { status: 404 });
  }
  return Response.json(backgroundTask);
}

export async function POST(request: Request) {
  const {
    id,
    type,
    payload
  }: { id: string, type: 'snipeMemeCoins', payload: string } =
    await request.json();

  if (!payload || !type) {
    return new Response('payload and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  await addBackgroundTask({
    id: id,
    createdAt: new Date(),
    type,
    payload,
    userId: session.user.id
  });

  return new Response('Background task added', { status: 200 });
}
