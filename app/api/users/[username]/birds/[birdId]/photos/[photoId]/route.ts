import { getUserByUsername, deleteUserPhoto } from '@/lib/db';
import { deleteFromGCS } from '@/lib/storage';
import { requireOwnership } from '@/lib/auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string; birdId: string; photoId: string }> }
) {
  const { username, photoId } = await params;
  if (!(await requireOwnership(req, username))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const photo = await deleteUserPhoto(user.id, Number(photoId));
  if (!photo) return Response.json({ error: 'Not found' }, { status: 404 });

  const gcsPath = photo.url.replace('/api/photos/', '');
  await deleteFromGCS(gcsPath);
  return Response.json({ ok: true });
}
