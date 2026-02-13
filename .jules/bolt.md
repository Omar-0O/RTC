## 2025-02-18 - Admin Reports Performance Bottleneck
**Learning:** `src/pages/admin/Reports.tsx` fetches all data and performs expensive client-side filtering (O(N) or worse) on every render. This includes iterating over thousands of submissions multiple times to calculate trends, stats, and filtered lists.
**Action:** When working on report-like pages, always verify if derived data is memoized using `useMemo`. If data is fetched once but processed heavily, memoization is critical for UI responsiveness.
