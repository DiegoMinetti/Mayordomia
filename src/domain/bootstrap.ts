import { z } from 'zod';

/**
 * Domain rules and contracts for organization bootstrap.
 *
 * The ceremony is one-shot per Google account: if the caller already has an
 * organization, the gateway returns the existing descriptor instead of
 * creating a duplicate. Frontend uses this schema to validate the wizard form
 * before sending the request, and the gateway re-validates server-side.
 */

export const TIMEZONE_REGEX = /^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$/;

export const bootstrapFormSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  timezone: z
    .string()
    .trim()
    .min(1, 'Zona horaria requerida')
    .max(80)
    .refine((tz) => TIMEZONE_REGEX.test(tz) || tz === 'UTC', {
      message: 'Zona horaria inválida (ej: America/Argentina/Buenos_Aires)',
    }),
  siteName: z.string().trim().max(120, 'Máximo 120 caracteres').optional().or(z.literal('')),
  siteAddress: z.string().trim().max(240, 'Máximo 240 caracteres').optional().or(z.literal('')),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Tenés que aceptar los términos para continuar' }),
  }),
});

export type BootstrapFormValues = z.infer<typeof bootstrapFormSchema>;

export interface OrganizationDescriptor {
  organizationId: string;
  name: string;
  rootFolderId: string;
  databaseFileId: string;
  schemaVersion: number;
  ownerEmail?: string;
  isOwner?: boolean;
  site?: {
    id: string;
    organizationId: string;
    name: string;
  } | null;
  isFirstUser?: boolean;
}

export interface OrganizationSummary {
  organizationId: string;
  name: string;
  rootFolderId: string;
  databaseFileId: string;
  schemaVersion: number;
  isOwner: boolean;
}

export interface BootstrapResult {
  ok: boolean;
  descriptor?: OrganizationDescriptor;
  error?: { code: string; message: string };
}

export interface ListMineResult {
  ok: boolean;
  organizations?: OrganizationSummary[];
  error?: { code: string; message: string };
}

/** First user of a brand-new organization always gets SUPER_ADMIN. */
export const FIRST_USER_ROLE = 'SUPER_ADMIN' as const;

/** Default timezone used when the form leaves it blank. */
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires' as const;
