## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.
## 2024-05-23 - [Inconsistent Password Toggles]
**Learning:** Password visibility toggles are manually implemented across multiple files using icon buttons inside `Input` wrappers, consistently lacking `aria-label` and keyboard focus styles.
**Action:** When touching authentication forms, always add localized `aria-label` (e.g., 'Show password') and ensure `focus-visible` styles match the input's focus ring.
