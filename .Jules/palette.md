## 2024-05-22 - [Inaccessible Custom File Uploads]
**Learning:** The app uses custom-styled `div` elements with `onClick` for file uploads, bypassing native keyboard accessibility and screen reader support.
**Action:** Always replace these with semantic `<button type="button">` or `<label>` elements wrapping the input, ensuring `type="button"` prevents form submission and adding `focus-visible` styles for keyboard users.

## 2024-05-23 - [Icon-only Toggle Buttons]
**Learning:** Multiple password input fields use icon-only buttons (Eye/EyeOff) for visibility toggling without any accessible label, making them invisible to screen readers.
**Action:** Always add dynamic `aria-label` attributes to icon-only toggle buttons that describe the current action (e.g., "Show password" vs "Hide password"), utilizing localization keys.
