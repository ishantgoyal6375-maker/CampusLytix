import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { count, eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
}

const DEFAULT_ADMIN_EMAILS = new Set(
  [
    process.env.ADMIN_EMAIL,
    'ishantgoyal6375@gmail.com',
  ]
    .filter((e): e is string => Boolean(e && e.trim()))
    .map((e) => e.trim().toLowerCase())
);

export async function syncFirebaseUser(decoded: DecodedIdToken): Promise<DbUser> {
  const uid = decoded.uid;
  const email = (decoded.email ?? `${uid}@clubpulse.local`).toLowerCase();
  const displayName = decoded.name ?? email.split('@')[0];
  const photoUrl = decoded.picture ?? null;

  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email,
          displayName,
          photoUrl,
          lastLoginAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const totalUsersResult = await db.select({ value: count() }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.value ?? 0);
    const assignedRole =
      totalUsers === 0 || DEFAULT_ADMIN_EMAILS.has(email) ? 'ADMIN' : 'VIEWER';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        photoUrl,
        role: assignedRole,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          photoUrl,
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Failed to sync Firebase user to PostgreSQL:', error);
    throw new Error('User synchronization failed.', { cause: error });
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in with Google.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing.' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.dbUser = await syncFirebaseUser(decodedToken);
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.user = decodedToken;
        req.dbUser = await syncFirebaseUser(decodedToken);
      } catch {
        // Proceed unauthenticated for read-only aggregate views
      }
    }
  }
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.dbUser.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Administrator privileges are required for this operation.',
    });
  }
  next();
};
