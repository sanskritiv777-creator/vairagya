# Dashboard navigation, theme, and onboarding

## Scope
Keep Vairagya's current visual system and application behavior. Update only dashboard page organization, the existing theme setting, and onboarding theme synchronization.

## Changes
- Turn the existing home dashboard and Financial Statements panel into two horizontal, swipeable dashboard pages, with a subtle accessible page indicator and touch/trackpad navigation that does not capture vertical scrolling.
- Keep the existing statements calculation/data layer and transaction data; remove only the Financial Statements row from the menu. Route the existing dashboard shortcut to the statements page.
- Add Dark, Light, and System selection to existing Settings using the persisted theme helper and semantic theme tokens.
- Retain the existing three-slide onboarding component and vertical snap/swipe behavior; keep its displayed theme synchronized with the saved preference and system changes.

## Technical details
Use the existing authenticated app route and `FinancialStatementsPanel`/`buildStatements()` path; do not change auth, backend, transaction ingestion, Android, or database code. Validate with the available TypeScript check, production build, and focused browser checks for page swipes, settings persistence, and onboarding slide navigation.
