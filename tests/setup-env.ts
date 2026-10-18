import { assertTestDatabase, testEnv } from "./test-env";

Object.assign(process.env, testEnv);
assertTestDatabase(process.env.DATABASE_URL);
