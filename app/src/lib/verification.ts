/**
 * Content-verification helpers shared by the admin CMS screen and the mock.
 * "Needs re-verification" = the verified_on date is more than six months old.
 */

/** Six months in ms (183 days). */
export const SIX_MONTHS_MS = 183 * 24 * 3600 * 1000;

export function needsReverification(
  verifiedOn: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!verifiedOn) return true;
  return now - new Date(verifiedOn).getTime() > SIX_MONTHS_MS;
}
