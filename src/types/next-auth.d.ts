import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      clientId: string | null;
      gbpClientIds: number[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    clientId: string | null;
    gbpClientIds: number[];
  }
}
