# Minimalist mobile home refinement

## Scope
Refine only the authenticated home screen in the existing Vairagya app. Keep all current detail panels, bottom navigation, add-transaction flow, imported data, calculations, authentication, backend, and Android capture systems unchanged.

## Changes
- Simplify the greeting and Safe to Spend area into one calm, tappable money card showing only the balance, runway, and tax percentage.
- Replace the separate Today/Week/Month cards with one compact selector and one smoothly updating spending summary.
- Make the spending summary open the existing expense details.
- Keep only the three newest transactions on Home, with a See all action opening the existing full history; make rows open that history.
- Remove duplicated detailed summaries, received lists, statements card, highest-expense card, and tax reminder from Home only; retain their existing menu, shortcut, and detail destinations.
- Preserve the four quick actions, floating add button, header controls, and bottom navigation.

## Validation
- Check the live home screen at 360px, 390px, and 412px widths for clipping, overflow, touch behavior, and reasonable scrolling.
- Run the existing TypeScript check and production build through the project harness.
- Confirm only presentation code changed and all data/auth/import behavior remains untouched.
