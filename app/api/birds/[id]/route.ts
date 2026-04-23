import { getBirdById, updateBird } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bird = await getBirdById(Number(id));
  if (!bird) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(bird);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { discovered?: 0 | 1; field_notes?: string };
  await updateBird(Number(id), body);
  const bird = await getBirdById(Number(id));
  return Response.json(bird);
}
