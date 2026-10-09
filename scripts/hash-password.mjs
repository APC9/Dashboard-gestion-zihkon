#!/usr/bin/env node
// Genera ADMIN_PASSWORD_HASH. Uso: npm run hash-password -- "mi-contraseña-segura"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Uso: npm run hash-password -- \"contraseña\"  (mínimo 12 caracteres)");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nADMIN_PASSWORD_HASH (base64, recomendado para .env / Docker / Coolify):");
console.log(Buffer.from(hash).toString("base64"));
console.log("\nHash bcrypt en bruto (si tu plataforma no interpreta los '$'):");
console.log(hash, "\n");
