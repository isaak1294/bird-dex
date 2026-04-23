import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    // dotenv interprets \n in double-quoted values; replace in case it doesn't
    private_key: (process.env.GCS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
});

const bucket = storage.bucket(process.env.GCS_BUCKET!);

export function publicUrl(filename: string): string {
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${filename}`;
}

export async function uploadToGCS(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const file = bucket.file(filename);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
  });
  return publicUrl(filename);
}

export async function deleteFromGCS(filename: string): Promise<void> {
  await bucket.file(filename).delete({ ignoreNotFound: true });
}
