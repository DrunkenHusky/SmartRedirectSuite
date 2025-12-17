## 2025-05-23 - Micro-interactions for Feedback
**Learning:** Adding immediate visual feedback (icon swap + text change) to copy buttons significantly reduces user uncertainty compared to just showing a toast or alert.
**Action:** Apply this pattern to all "Copy to Clipboard" interactions in the future.
## 2025-10-26 - Icon-Only Buttons Accessibility
**Learning:** The Admin interface uses several icon-only buttons (Trash icons) for destructive actions without `aria-label` attributes. This makes them inaccessible to screen reader users who won't know what the button does.
**Action:** Always add `aria-label` to buttons that don't have visible text, explaining the action clearly.
