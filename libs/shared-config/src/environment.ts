/**
 * The only environment access point used outside configuration factories and
 * CLI data-source/seed bootstraps. Runtime modules consume this read-only
 * view so environment access remains centralized and easy to audit.
 */
export const environment: NodeJS.ProcessEnv = process.env;
