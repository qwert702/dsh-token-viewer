/**
 * TokenPanelIcon: the glyph the sidebar renders in the Token row of its global
 * panel list (`sidebar.panellist`). The list entry owns only the icon — the
 * sidebar draws the button, its label (resolved from the entry's `label`), and
 * the active/hover styling — so this component reads the owner share
 * (`size`, `active`) and nothing else.
 *
 * `currentColor` is deliberate: the sidebar's panel row sets the text color
 * (`--dsw-alias-label-primary`, dimmed in the rail), so the glyph follows the
 * row's active and hover states without duplicating that palette here.
 */
import css from './TokenPanelIcon.module.css'

/** Owner share supplied by the sidebar's global panel row. */
export interface TokenPanelIconProps {
  /** Requested square edge in pixels (16 wide, 18 in the collapsed rail). */
  size: number
  /** Whether this panel is the selected one in the main column. */
  active: boolean
}

/**
 * Render the Token panel glyph: three ascending usage bars.
 * @param props - requested edge and selection state.
 * @returns the icon element.
 */
export function TokenPanelIcon({ size }: TokenPanelIconProps) {
  return (
    <svg
      className={css.icon}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.25 12.75V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 12.75V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.75 12.75V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 14.25h11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
