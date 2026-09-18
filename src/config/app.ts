/**
 * App-level configuration.
 *
 * v1 is single-tenant: one hardcoded pilot organization. Keeping this in one
 * place means moving to multi-tenant later is a contained change — nothing else
 * should assume "one org" beyond what reads from here.
 */

export const appConfig = {
  /** Display name shown in platform chrome. Church content overrides the feel inside. */
  brandName: 'Ekklē',
  tagline: 'gathered together',

  /**
   * The single pilot organization slug. The actual org row lives in the DB
   * (see seed.sql); this is the well-known handle the app resolves it by.
   */
  pilotOrgSlug: 'pilot',

  /** Hard product constraints from the MVP spec. */
  limits: {
    shortMessageMaxLength: 60,
  },

  /**
   * Feature flags. Phase B features are scaffolded but disabled until built.
   * Flip these on as sprints land so partial work never ships to recipients.
   */
  features: {
    resourceHub: false, // Phase B
    seekerAccounts: false, // Phase B
  },
} as const;

export type AppConfig = typeof appConfig;
