# Milki Console UI System (Design Division)

## Visual Direction
- Brand posture: trusted, grounded, Tanzanian-first, enterprise-readable.
- Tone: formal data instrument rather than consumer app.
- Visual motif: coastal-earth palette + precision cards for registry analytics.

## Design Tokens
- `--bg`: warm neutral sand.
- `--ink`: deep green-black for strong contrast.
- `--brand`: registry green for primary actions.
- `--brand-2`: teal support tone.
- `--accent`: amber for caution and pending states.

## Component Contract
- Buttons:
  - Primary: gradient green, used for mutating actions (`Register`, `Verify`, `Download PDF`).
  - Disabled state: opacity reduction only, no layout shift.
- Status pill:
  - `ok`: green tone
  - `warn`: amber tone
  - `error`: red tone
- Response panel:
  - Monospace, scrollable, max-height bounded to viewport to prevent mobile overflow.

## Accessibility Rules
- Inputs and selects must have visible labels.
- Focus ring must be visible at 3:1 contrast minimum.
- Touch targets must remain >= 42px on small devices.
- JSON response area must preserve line wraps for narrow screens.
