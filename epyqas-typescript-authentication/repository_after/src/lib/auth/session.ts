import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET || 'a-very-secure-fallback-secret-for-educational-purposes-123';
const SESSION_COOKIE_NAME = 'auth_session';

export interface SessionPayload {
  userId: string;
  username: string;
  expiresAt: number;
}

/**
 * Helper to get the crypto key for HMAC
 */
async function getCryptoKey() {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Creates a new session by generating a signed token and setting it in cookies.
 */
export async function createSession(userId: string, username: string) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload: SessionPayload = { userId, username, expiresAt };
  const token = await encryptSession(payload);
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/',
  });
}

/**
 * Retrieves and validates the session from cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await decryptSession(token);
  if (!payload || payload.expiresAt < Date.now()) {
    return null;
  }
  return payload;
}

/**
 * Deletes the session cookie.
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * "Encrypts" (signs) a session payload using Web Crypto API.
 * Format: base64(payload).signature
 */
async function encryptSession(payload: SessionPayload): Promise<string> {
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  
  // Base64 encode the data
  // Use Buffer for base64 if available (Node.js/Edge) or btoa
  // Buffer is safer for all characters
  const base64Data = Buffer.from(data).toString('base64');
  
  const key = await getCryptoKey();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(base64Data));
  
  // Convert signature to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${base64Data}.${signatureHex}`;
}

/**
 * Decrypts (verifies) a session token using Web Crypto API.
 */
async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) return null;

    const encoder = new TextEncoder();
    const key = await getCryptoKey();
    
    // Verify the signature
    // Convert hex signature back to bytes
    const signatureBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(base64Data)
    );

    if (!isValid) return null;

    const data = Buffer.from(base64Data, 'base64').toString();
    return JSON.parse(data) as SessionPayload;
  } catch (error) {
    console.error('Session decryption failed:', error);
    return null;
  }
}
