/**
 * Escapes SQL LIKE wildcard characters (%, _) in user input, so a search
 * term matches literally instead of as a pattern. Without this, a customer
 * email containing a literal "%" or "_" would silently match far more (or
 * fewer) rows than the user actually typed — not a security bug (still
 * parameterized), but a correctness one: silently wrong search results.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
