## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.

## 2026-02-12 - [Inaccessible Password Toggle]
**Learning:** Password inputs were using raw `button` elements positioned inside `div`s, lacking `aria-label` and `focus-visible` styles, making them inaccessible to keyboard and screen reader users.
**Action:** Always verify custom interactive elements like password toggles have `aria-label` describing the *current state* (Show/Hide) and explicit focus styles to match the design system.
