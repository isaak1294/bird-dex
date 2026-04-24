import { getUserByUsername, deleteUserPhoto } from '@/lib/db';
import { deleteFromGCS } from '@/lib/storage';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ username: string; birdId: string; photoId: string }> }
) {
  const { username, photoId } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const photo = await deleteUserPhoto(user.id, Number(photoId));
  if (!photo) return Response.json({ error: 'Not found' }, { status: 404 });

  const gcsPath = photo.url.replace('/api/photos/', '');
  await deleteFromGCS(gcsPath);
  return Response.json({ ok: true });
}
