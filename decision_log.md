# Decision Log — Roberto

## Authorship declaration

*"I wrote this decision log entirely without AI assistance. The only tool I used on it was spell-check."*
---

## Issues addressed

> Defects, security smells, architectural problems, missing pieces, scaling risks — anything you decided was worth your time. For each, fill in **every** sub-field. An empty field is a worse signal than an awkward answer.

- **Issue 1 — IDOR Vulnerability**
- What was wrong or weak: The SQL statement `return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;` failed to verify if the requesting user belonged to the same organization. If a user tested various IDs and happened to guess a valid one, they could access unauthorized information, leading to privacy and legal issues. 
- Nature of the improvement: The filter `AND merchant_id = ?` was added to the query in `orders-dal.ts`, and the method now accepts `merchant_id` to perform the validation. 
- **Confidence (1–10):** 8
- **What would invalidate this fix:**
Two scenarios: requesting an order belonging to a different merchant and receiving a response other than 404, or requesting an item I have access to but receiving a 404 response instead of a 200.

- **Points of disagreement with Claude:**
Claude focused only on the immediate fix rather than a more robust long-term solution. It suggested a simple patch but could have proposed a stronger approach—such as a function accepting `merchant_id` to handle `getById` calls or any request prone to the type of data leakage identified here. Additionally, the suggested test case did not account for scenarios where `merchantId` is `undefined`. 

- Alternatives considered and rejected:
Creating a database function that accepts both `merchant_id` and `id` parameters to return an error directly from the database, rather than handling it in the application code. I rejected this because modifying the `orders-dal.ts` method offered a faster solution and avoided unnecessary database configuration changes.


- **Issue 2 — Incorrectly calculated date range**
- What was wrong or weak: Date ranges were calculated using string comparisons without a standard format, comparing `CURRENT_TIMESTAMP` against raw strings provided by the `revenue.ts` and `orders.ts` components. This caused orders to go missing because they failed to meet the `created_at` comparison condition in `orders.ts`; the system did not know the correct timeframe or comparison method to use. 
- Shape of my improvement: I defined a business rule regarding order time zones (pending lead approval) and decided to create a reusable component to handle the raw `from`/`to` data, rather than modifying each existing component individually. Simply put, it takes the raw dates and converts them to UTC notation using the (T,Z) format, making them easy to compare. I also modified a field in the `orders` table to ensure consistency with this change: `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`. This standardizes date comparisons based on the Mexico time zone. 
- **Confidence (1–10):** 7
- **What would falsify this fix:** If a database already existed and requests were sent, these changes would not be reflected because the table creation instruction is `CREATE TABLE IF NOT EXISTS orders`. Consequently, the conversion comparison would continue to fail until the database was dumped and the table recreated; only then would the solution take effect. - **I disagreed with Claude on:** Claude failed to consider various scenarios this time; he suggested solutions without a solid basis or a full analysis of the impact of altering a production table's structure. Furthermore, regarding time zone conversion, he proposed methods involving complex libraries that were not applicable—at least not at this stage—so I rejected his implementation of the `lib\dates.ts` component and instructed him to implement a simpler solution instead. 
- Alternatives I considered and rejected: I considered using UTC-0 to standardize time zones, but that solution would only have made sense if we had a business rule requiring us to handle time zones across different countries. I also considered restructuring the table to use a `created_at` format truncated to the second, as millisecond precision is not required for this implementation.

- **Issue 3 — Routing fix for `metrics.ts`**
- What was wrong or weak: The `metrics.ts` component was opening its own database connection. This could lead to inconsistencies in future updates if DAL methods changed while `metrics` remained outdated. 
- Shape of my improvement: I moved the `summaryByMerchant` query logic to the `orders-dal.ts` DAL; now, `metrics` simply references the methods to retrieve the data without opening a connection itself. 
- **Confidence (1–10):** 10
- **What would falsify this fix:** The presence or re-introduction of a `new Database` code snippet, or if the `summaryByMerchant` methods returned values ​​different from the current ones. 
- **I disagreed with Claude on:**
- Alternatives I considered and rejected: I didn't have any points of disagreement with Claude this time; although the change might seem simple, one must always carefully review the DAL to ensure SQL queries align with each method's requirements. However, the tests don't validate the scenario where a merchant has no orders, so I will request that such a test be added.

## Feature chosen

- **Feature:** Full CSV report on customer orders.
- **Why this one and not the others:** Because consumer data is valuable to staff; they can use it internally for their own calculations or KPIs without having to request the information from the IT department.
- **What I cut to ship it in budget:** Exploring alternative approaches that yield the same results—such as pagination, which would allow displaying all data without overloading the view, or enabling direct data downloads without hitting the database—though these would require a dashboard redesign.
- **Confidence (1–10) that the shape I picked is the right one:** 8
- **What would change my mind:** A spike in database server load caused by multiple clients attempting to download reports simultaneously. At that point, a method for optimizing report downloads would need to be selected.


- **Feature:** Data filter.
- **Why this one and not the others:** Because it is complementary and aids in better data visualization, it creates a visually complete dashboard with filters, allowing us to quickly filter the specific information we need regarding the user or users.
- **What I cut to ship it in budget:** We didn't make major cuts; we simply streamlined the use of the main table. Since most of the services were already built and several potential bugs had already been resolved, that helped us make the task more efficient.
- **Confidence (1–10) that the shape I picked is the right one:** 7
- **What would change my mind:** Scalability and user growth are concerns; for instance, a user might have 100,000 sales records. Even though the table is paginated and the query includes an `.iterate()` method, there is no guarantee the system won't fail under massive load, as this scenario has not been tested.

## Things I noticed but did NOT fix
I noted a lack of tests for existing routes, meaning they are currently unvalidated; additionally, the database design requires re-planning prior to deployment due to issues regarding the `created_at` column and time zones. Another issue I was unable to resolve—or investigate further—was the CSV download process; a change in method (using `.all()` instead of `iterate()`) is still under consideration, but these are business rules that require careful definition.
> Class-of-bug instances you saw and chose not to touch. For each, name the *reason* you cut it (scope / time / dependency / "needs a larger conversation").

-

## Docs / code I left alone deliberately
The query in `orders-dal.ts` was initially a candidate for modification, but as I investigated further, I realized the error originated upstream in other components that were sending unsanitized dates. So, rather than deliberately altering the query, I created a dedicated component for date validation.
Regarding the table restructuring, I’ve noted this as a pending task; deciding on a schema change without confirming the business rules carries significant risk, so we opted for a temporary solution while we resolve the issue.
-

## What I'd do with another 6 hours
To start, I would implement the two missing features, as they are fundamental to the project—specifically, the ability to filter and manipulate data from the dashboard is a crucial aspect that requires careful attention. If I had more time, I would implement data pagination to ensure the full dataset is accessible within the dashboard view, as well as a search bar; these elements would be incredibly helpful for the reporting staff.
-

## Where I felt uncertain
Definitely regarding the business rule for selecting the time zone; since I wasn't sure if it applied, I made a temporary decision to set it to Mexico—that was the decision I felt least confident about. I also felt uncertain when considering the schema change, as I had to decide whether to simply modify a field in the `orders` table or restructure the entire thing.
> At least three places in this submission where you were not confident. Genuine uncertainty is a strength signal. "Nothing — I was confident everywhere" is itself a red flag and will be probed.

-
-
-
