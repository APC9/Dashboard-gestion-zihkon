import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` no necesita conexión: durante el build de Docker
// DATABASE_URL puede no existir, por eso no usamos env() (que lanza error).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
