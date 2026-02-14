## 2026-02-14 - Redundant Date Instantiation in Filter Loops
**Learning:** Calling helper functions like `getDateRange()` that instantiate `new Date()` inside an O(N) filter loop causes significant performance overhead. Each call creates new object references and triggers date parsing logic repeatedly for the same boundary values.
**Action:** Extract constant or derived values (like date ranges) outside of loops. Use `useMemo` to cache these values and the filtered results to prevent recalculation on every render, especially when the dependencies (like `dateRange` state) haven't changed.
