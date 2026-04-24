import { Storage } from '@google-cloud/storage';

const creds = JSON.parse(Buffer.from(process.env.GCS_CREDENTIALS!, 'base64').toString('utf-8'));
const storage = new Storage({ credentials: creds });
const bucket = storage.bucket(process.env.GCS_BUCKET!);

// Photos are served through /api/photos/[...path] — bucket stays private.
export function proxyUrl(gcsPath: string): string {
  return `/api/photos/${gcsPath}`;
}

export async function uploadToGCS(
  gcsPath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await bucket.file(gcsPath).save(buffer, { metadata: { contentType: mimeType } });
  return proxyUrl(gcsPath);
}

export async function downloadFromGCS(gcsPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const file = bucket.file(gcsPath);
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { buffer, contentType: (metadata.contentType as string) || 'image/jpeg' };
}

export async function deleteFromGCS(gcsPath: string): Promise<void> {
  await bucket.file(gcsPath).delete({ ignoreNotFound: true });
}
