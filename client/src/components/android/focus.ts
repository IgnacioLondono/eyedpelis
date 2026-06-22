export function scrollIntoViewHorizontal(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

export const tvFocusClass =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-glow focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:scale-[1.06] transition-transform duration-200';

export const mobileTapClass =
  'active:scale-[0.97] transition-transform duration-150';
