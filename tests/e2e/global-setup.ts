import { resetDb } from "./db";

export default async function globalSetup() {
  await resetDb();
}
