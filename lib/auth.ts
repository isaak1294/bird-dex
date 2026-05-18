import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY = '365d';
const COOKIE_NAME = 'birddex_token';

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) return bcrypt.compare(input, stored);
  // Legacy plaintext — still valid, caller should re-hash on success
  return input === stored;
}

export async function signToken(userId: number, username: string): Promise<string> {
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret());
}

export async function verifyToken(
  token: string
): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as number,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}

export function tokenFromRequest(req: Request): string | null {
  // Native app sends Authorization: Bearer <token>
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  // Web browser sends cookie automatically
  const cookie = req.headers.get('Cookie');
  const match = cookie?.match(/(?:^|;\s*)birddex_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function requireOwnership(req: Request, username: string): Promise<boolean> {
  const token = tokenFromRequest(req);
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.username.toLowerCase() === username.toLowerCase();
}

export function makeTokenCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}

export function clearTokenCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
