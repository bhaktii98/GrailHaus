function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} — copy server/.env.example to server/.env`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  /** Signs/verifies the app's own access tokens (email/password auth) — unrelated to
   * Supabase, which the admin dashboard's separate magic-link login still uses. */
  appJwtSecret: required("APP_JWT_SECRET"),
};
