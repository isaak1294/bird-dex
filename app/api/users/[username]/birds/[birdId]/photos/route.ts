import { getUserByUsername, getUserBirdById, addUserPhoto } from '@/lib/db';
import { uploadToGCS } from '@/lib/storage';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string; birdId: string }> }
) {
  const { username, birdId } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const bird = await getUserBirdById(user.id, Number(birdId));
  if (!bird) return Response.json({ error: 'Bird not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('photo') as File | null;
  const caption = (formData.get('caption') as string) ?? '';
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
  if (!allowed.includes(ext)) return Response.json({ error: 'Invalid file type' }, { status: 400 });

  const filename = `users/${user.id}/${birdId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToGCS(filename, buffer, file.type || 'image/jpeg');

  const photo = await addUserPhoto(user.id, Number(birdId), url, caption);
  return Response.json(photo, { status: 201 });
}
