## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.
