# Palette's Journal

## 2024-05-22 - Initial Setup
**Learning:** This repo uses `npm` and `package-lock.json`, not `pnpm`.
**Action:** I will use `npm` for all commands despite the standard Palette instructions.
## 2025-05-23 - Micro-interactions for Feedback
**Learning:** Adding immediate visual feedback (icon swap + text change) to copy buttons significantly reduces user uncertainty compared to just showing a toast or alert.
**Action:** Apply this pattern to all "Copy to Clipboard" interactions in the future.
## 2025-10-26 - Icon-Only Buttons Accessibility
**Learning:** The Admin interface uses several icon-only buttons (Trash icons) for destructive actions without `aria-label` attributes. This makes them inaccessible to screen reader users who won't know what the button does.
**Action:** Always add `aria-label` to buttons that don't have visible text, explaining the action clearly.
## 2025-12-18 - Keyboard Access for Tooltips
**Learning:** Radix UI `TooltipTrigger` requires its child to be focusable for keyboard users to perceive the tooltip. Simple `div` or `span` wrappers must have `tabIndex={0}` and appropriate ARIA roles/labels.
**Action:** Ensure all interactive-but-non-button elements triggering tooltips are keyboard focusable.
## 2025-12-24 - Clickable Code Blocks
**Learning:** Users instinctively try to click code blocks (like URLs/IDs) to copy them. Adding explicit click-to-copy behavior with `role="button"` and `tabIndex={0}` aligns the UI with this mental model while maintaining accessibility.
**Action:** Enhance static code displays that represent copyable data (URLs, Keys) by making them interactive copy triggers.

