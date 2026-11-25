import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "purchasing_idcard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface VerifiedSession {
  idCard: string;
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  return crypto
    .createHash("sha256")
    .update(`purchasing-session:${process.cwd()}:${process.env.DATABASE_URL || "local"}`)
    .digest("hex");
}

export function signSessionToken(payload: {
  idCard: string;
  userId: string;
  role: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: VerifiedSession = {
    idCard: payload.idCard.trim().toUpperCase(),
    userId: payload.userId,
    role: payload.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token?: string | null): VerifiedSession | null {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<VerifiedSession>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof parsed.idCard !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < now
    ) {
      return null;
    }
    return {
      idCard: parsed.idCard.trim().toUpperCase(),
      userId: parsed.userId,
      role: typeof parsed.role === "string" ? parsed.role : "STAFF",
      iat: typeof parsed.iat === "number" ? parsed.iat : now,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function setUserSessionCookie(payload: {
  idCard: string;
  userId: string;
  role: string;
}) {
  const token = signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: process.env.USE_HTTPS_COOKIE === "true",
  });
}

export async function clearUserSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getVerifiedUserSession(): Promise<VerifiedSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(raw);
}
