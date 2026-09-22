// Shared glyph for both the sidebar and form-panel collapse toggles -- a
// window outline with one side filled, the VS Code / devtools "toggle panel"
// convention, not a hamburger or a plain arrow. Deliberately static (doesn't
// change shape based on collapsed/expanded state, matching that convention):
// the button's title/aria-label carries the state, the icon just marks "this
// button toggles a panel."
export default function PanelToggleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.25 3.3v9.4" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2.6" y="3.6" width="2.8" height="8.8" rx="0.6" fill="currentColor" />
    </svg>
  )
}
