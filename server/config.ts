import { z } from "zod";

const booleanValue = z.enum(["true", "false"]).transform(value => value === "true");

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DATABASE_SSL: booleanValue.default(false),
  SESSION_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  OAUTH_ISSUER_URL: z.string().url().optional(),
  OAUTH_CLIENT_ID: z.string().min(1).optional(),
  OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  OAUTH_SCOPES: z.string().default("openid profile email"),
  OAUTH_ADMIN_GROUP: z.string().min(1).optional(),
  OAUTH_GROUPS_CLAIM: z.string().default("groups"),
  COOKIE_SECURE: booleanValue.optional(),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  ALLOWED_ORIGINS: z.string().default(""),
}).superRefine((configuration, context) => {
  const oauthValues = [configuration.OAUTH_ISSUER_URL, configuration.OAUTH_CLIENT_ID,
    configuration.OAUTH_CLIENT_SECRET, configuration.OAUTH_REDIRECT_URI];
  if (oauthValues.some(Boolean) && !oauthValues.every(Boolean)) {
    context.addIssue({ code: "custom", path: ["OAUTH_ISSUER_URL"], message: "OAuth configuration must be complete" });
  }
  if (!configuration.ADMIN_PASSWORD && !oauthValues.every(Boolean)) {
    context.addIssue({ code: "custom", path: ["ADMIN_PASSWORD"], message: "Configure ADMIN_PASSWORD or OAuth" });
  }
});

export type ApplicationConfiguration = z.infer<typeof environmentSchema> & { oauthEnabled: boolean };

export function loadConfiguration(environment: NodeJS.ProcessEnv = process.env): ApplicationConfiguration {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return { ...parsed.data, oauthEnabled: Boolean(parsed.data.OAUTH_ISSUER_URL) };
}
