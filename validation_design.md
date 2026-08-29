# Validation design — Roberto

> **Write this yourself, without AI assistance.** Spell-check is fine. AI-drafted validation design is an automatic decline — this artifact measures *your* judgment about how to make AI-augmented code safe to ship, which is the load-bearing architect-tier signal.
>
> ~300 words total. Concrete, named gates only — not philosophy.

## Authorship declaration
*"I wrote this validation design entirely without AI assistance. The only tool I used was spell-check."*

---

## The question

Anyone with a competent AI tool can fix the symptoms in this codebase. What separates an architect is *building the validation layer that catches the class of bug next time* — so the same mistake cannot quietly reach production again.

For each issue class you addressed, name the gate you built (or would build with more time) that prevents the class — not just the instance. "Added a regression test" is the floor; what's the gate?

Forms a gate can take, in rough order of robustness:

- A regression test pointing at the specific bug (floor — always add this, never the whole answer)
- A property-based or fuzz test that asserts an invariant the bug violated
- A golden test / contract test at the API boundary
- A CI rule, lint rule, or pre-merge script that fails on the pattern
- A type-system constraint that makes the bug uncompilable
- An architecture rule or import-restriction that makes the bad shape impossible
- An eval suite that grades AI output against the class of failure

## What to fill in

For each issue *class* you addressed (not each instance — group by class):

### Class 1 — Cross-Tenant IDOR

- **Instances I fixed:** A bug in `orders-dal.ts` that allowed access to other users' information if their ID number was known; the service responsible for this was `GET /api/orders/:id`.

- **The gate I built (or would build):**
I documented a plan to implement a function in `orders-dal.ts` that would be instantiated before accessing methods like `getById`, etc.

- **What this gate would catch that a regression test would miss:**
Tests only cover two specific, known cases; the proposed `forMerchant` function represents a structural design that serves as the sole access point to the methods, providing architectural-level protection.

- **Where to see the gate in the diff:** Not yet built. I applied a fix in `orders-dal.ts` (lines 38–49) to the `getById` method by adding `AND merchant_id = ?` and a condition—`if (!merchantId) return undefined;`—to ensure the field is not undefined.

- **If you did not build it:**
Due to time constraints, I prioritized the SQL clause filter and `merchant_id` validation; the proposed function was documented for future analysis.


### Class 2 — UTC conversion

- **Issues I fixed:** Comparison and time zone usage bugs in the `orders.ts` and `revenue.ts` components. When sending requests to fetch orders by date for the dashboard, these components were not sanitizing the dates or adhering to a standard format.

- **The gate I built (or would build):**
Modification of the `db.ts` component to include a default value of `strftime('%Y-%m-%dT%H:%M:%fZ','now')`. Note: this fails if a direct API insertion occurs (bypassing the components) while an old table still exists without having been recreated. I suggest a complete restructuring of the `merchant` and `orders` tables to include the time zone default value.

- **What this gate would catch that a regression test would miss:**
A test only covers known scenarios, whereas a complete restructuring of the tables would eliminate the root cause of the problem.


- **Where to see the gate in the diff:** `orders.ts`, `revenue.ts`, and `db.ts` in the commit.

- **If you did not build it:** The default value was implemented in `db.ts`, but the complete restructuring of the tables was proposed rather than implemented, as it requires confirmation of business rules regarding time zones.

### Class 3 — CSV injection

- **Instances I fixed:** Prevents fields starting with `=`, `+`, `-`, or `@` from being interpreted as formulas, which could otherwise lead to the execution of malicious code when the CSV file is downloaded.

- **The gate I built (or would build):** The `csv.ts` component verifies the integrity of CSV fields to prevent injection by prepending a `'` (single quote) to fields containing those prefixes.

- **What this gate would catch that a regression test would miss:** `test('csv: guards against formula injection')` only covers specific scenarios; we would need to run further tests and validate additional cases to fully understand the extent of our coverage.

- **Where to see the gate in the diff:** `lib/csv.ts 10-19`

- **If you did not build it:** Built.
---

## Anti-patterns we score against

- "Added regression tests" with no class-level gate proposed for any class. The instance is patched; the class is not.
- A gate proposed for every class but none actually built in the diff, with no honest accounting of why.
- Generic prose ("I would invest in observability and CI quality") with no named tool, rule, or invariant.
- A 30-line wall of suggestions that reads like an AI-generated checklist. We expect 1–3 *real* gates designed deliberately, not 10 generic ones.
