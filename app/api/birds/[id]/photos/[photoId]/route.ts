import { deletePhoto } from '@/lib/db';
import { deleteFromGCS } from '@/lib/storage';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { photoId } = await params;
  const photo = await deletePhoto(Number(photoId));
  if (!photo) return Response.json({ error: 'Not found' }, { status: 404 });

  // Extract the GCS object path from the full URL
  const gcsPath = photo.url.replace(`https://storage.googleapis.com/${process.env.GCS_BUCKET}/`, '');
  await deleteFromGCS(gcsPath);

  return Response.json({ ok: true });
}
