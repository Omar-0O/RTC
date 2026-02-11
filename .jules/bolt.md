## 2024-05-23 - Optimizing React Reports Component
**Learning:** Heavy data processing in React components (filtering, mapping, reducing large arrays) on every render causes significant performance degradation, especially when combined with un-memoized derived state. O(N*M) operations in render loops (like filtering profiles for each committee) are silent killers.
**Action:** Always memoize derived data processing using `useMemo`. Replace nested `filter` inside `map` with a single-pass aggregation using `Map` or object lookups to reduce complexity from O(N*M) to O(N).
