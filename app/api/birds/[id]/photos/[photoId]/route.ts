import { deletePhoto } from '@/lib/db';
import { deleteFromGCS } from '@/lib/storage';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { photoId } = await params;
  const photo = await deletePhoto(Number(photoId));
  if (!photo) return Response.json({ error: 'Not found' }, { status: 404 });

  // photo.url is /api/photos/{gcsPath} — strip the prefix to get the GCS object path
  const gcsPath = photo.url.replace('/api/photos/', '');
  await deleteFromGCS(gcsPath);

  return Response.json({ ok: true });
}
