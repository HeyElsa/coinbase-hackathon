import { getAllPendingTasks } from '@/lib/db/queries';
import type { NextRequest } from 'next/server';
import { snipeMemeCoinsTask } from '../tasks/snipeMemeCoinsTask';
 
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }
 
  const pendingTasks = await getAllPendingTasks();
  pendingTasks.forEach((task) => {
    if (task.type === 'snipeMemeCoins') {
        console.log(task);
        snipeMemeCoinsTask(task)
    }
  });
  return Response.json({ success: true });
}
