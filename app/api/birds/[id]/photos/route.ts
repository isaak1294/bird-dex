import { addPhoto, getBirdById, updateBird } from '@/lib/db';
import { uploadToGCS } from '@/lib/storage';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const birdId = Number(id);

  const bird = await getBirdById(birdId);
  if (!bird) return Response.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('photo') as File | null;
  const caption = (formData.get('caption') as string) ?? '';

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
  if (!allowed.includes(ext)) return Response.json({ error: 'Invalid file type' }, { status: 400 });

  const filename = `birds/${birdId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToGCS(filename, buffer, file.type || 'image/jpeg');

  if (!bird.discovered) await updateBird(birdId, { discovered: 1 });

  const photo = await addPhoto(birdId, url, caption);
  return Response.json(photo, { status: 201 });
}
