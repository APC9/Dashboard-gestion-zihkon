import "server-only";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { env } from "@/lib/env";
import { clearAttempts, clientIpFromHeaders, isRateLimited, registerFailedAttempt } from "./rate-limit";
import type { Role } from "./types";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/**
 * Acepta el hash bcrypt tal cual ("$2b$...") o codificado en base64,
 * útil porque Docker Compose interpreta los "$" de los ficheros .env.
 */
function resolvePasswordHash(raw: string): string {
  if (raw.startsWith("$2")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}

/**
 * MVP: un administrador definido por variables de entorno (sin tocar la BD).
 * FASE 2: sustituir `authorize` por una consulta a una tabla de usuarios
 * (ver prisma/proposed-migrations/003_admin_users.sql) que incluya rol y
 * client_id para usuarios CLIENT.
 */
async function authorizeAdmin(email: string, password: string) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_NAME } = env();
  const emailMatches = email === ADMIN_EMAIL.trim().toLowerCase();
  // Siempre se ejecuta bcrypt para no filtrar por tiempo si el email existe.
  const passwordMatches = await bcrypt.compare(password, resolvePasswordHash(ADMIN_PASSWORD_HASH));
  if (!emailMatches || !passwordMatches) return null;
  return { id: "admin", email: ADMIN_EMAIL, name: ADMIN_NAME, role: "ADMIN" as Role };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw, req) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const ip = clientIpFromHeaders(req?.headers ?? {});
        const key = `${ip}:${parsed.data.email}`;
        if (isRateLimited(key)) {
          throw new Error("Demasiados intentos. Espera unos minutos.");
        }

        const user = await authorizeAdmin(parsed.data.email, parsed.data.password);
        if (!user) {
          registerFailedAttempt(key);
          return null;
        }
        clearAttempts(key);
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & { role?: Role; clientId?: string | null; gbpClientIds?: string[] };
        token.role = u.role ?? "ADMIN";
        token.clientId = u.clientId ?? null;
        token.gbpClientIds = u.gbpClientIds ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub ?? "",
        role: token.role,
        clientId: token.clientId ?? null,
        gbpClientIds: token.gbpClientIds ?? [],
      };
      return session;
    },
  },
};
