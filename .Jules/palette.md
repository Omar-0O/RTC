## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.

## 2025-02-09 - [Admin UX Consistency]
**Learning:** Admin interfaces often use raw HTML inputs where user-facing pages use polished components. This creates a jarring disconnect in quality.
**Action:** Proactively port polished UI patterns (like the avatar upload with hover overlay) from user profiles to admin management forms to maintain consistent UX quality across roles.
