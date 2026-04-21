## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.

## 2024-05-24 - [Inaccessible Icon-Only Toggles]
**Learning:** Icon-only toggle buttons (Password visibility, Theme, Language) consistently lack `aria-label`, relying on visual cues (icons) or `title` attributes which are insufficient for screen readers.
**Action:** When creating or modifying icon-only buttons, always include a dynamic `aria-label` that reflects the button's *current action* (e.g., "Show password" vs "Hide password"), using the translation system (`t('auth.showPassword')`) for localization.
