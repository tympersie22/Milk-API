# Milki Console UX Flow (UX Architect)

## Core Journey
1. Register/Login
2. Generate API Key
3. Search or Verify property by `title_number` + `region`
4. Generate report request
5. Poll report status
6. Download signed JSON/PDF artifact

## Interaction States
- Report states:
  - `idle`: no report requested.
  - `processing`: polling in progress.
  - `completed`: signed downloads enabled.
  - `failed`: show backend error payload and recovery action.
- API errors:
  - Always render error code and request id.
  - Show context hint for known auth/quota errors.

## Mobile Behavior
- Two-column desktop collapses to one column at <= 900px.
- Action rows become stacked full-width buttons at <= 640px.
- Response panel height reduced for keyboard-friendly viewing.

## Future UX Work
- Add dedicated report history screen with filters by `status`, `region`, and `created_at`.
- Add optimistic toasts for report queueing and download completion.
