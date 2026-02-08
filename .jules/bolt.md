## 2024-05-23 - Memoize Expensive Calculations in Reports
**Learning:** React components, especially heavy ones like Reports dashboards, should memoize derived data (filtered lists, stats) to prevent re-calculation on every render.
**Action:** Use `useMemo` for derived data like `filteredSubmissions`, `committeeData`, `levelData`, `activityTrend`, `activityStats`, and `volunteersByLevel`.
