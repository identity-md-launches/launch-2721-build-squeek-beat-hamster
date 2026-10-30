export function icon(name: string, cls = ''): string {
  const paths: Record<string, string> = {
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
    muted: '<path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    flower: '<path d="M12 5C8-2 4 3 7 7 0 4-2 10 5 12c-7 2-5 8 2 5-3 7 3 9 5 2 2 7 8 5 5-2 7 3 9-3 2-5 7-2 5-8-2-5 3-4-1-9-5-2Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="4" fill="#302b19"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    restart: '<path d="M4 9a8 8 0 1 1 1 9M4 3v6h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    trophy: '<path d="M7 3h10v7c0 6-10 6-10 0V3Zm5 12v6m-5 0h10M7 5H3v4c0 3 4 3 4 3m10-7h4v4c0 3-4 3-4 3"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    seed: '<path d="M19 4c-9-2-16 2-14 10 8 4 15-1 14-10ZM5 20 16 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  };
  return `<svg class="icon ${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.seed}</svg>`;
}
export function hamsterScene(act = 0, compact = false): string {
  return `<svg class="hamster-scene ${compact ? 'compact' : ''} scene-act-${act}" viewBox="0 0 660 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><radialGradient id="halo"><stop stop-color="#a7c56e" stop-opacity=".13"/><stop offset="1" stop-color="#a7c56e" stop-opacity="0"/></radialGradient><linearGradient id="fur" x1="300" y1="190" x2="360" y2="340" gradientUnits="userSpaceOnUse"><stop stop-color="#e4b67c"/><stop offset="1" stop-color="#bd8555"/></linearGradient><linearGradient id="rim" x1="210" y1="85" x2="450" y2="330" gradientUnits="userSpaceOnUse"><stop stop-color="#b3c785"/><stop offset=".6" stop-color="#61704c"/><stop offset="1" stop-color="#b3c785"/></linearGradient></defs>
  <ellipse cx="330" cy="207" rx="280" ry="203" fill="url(#halo)"/>
  <g class="scene-sky" fill="#d3c79c"><circle cx="90" cy="95" r="2"/><circle cx="556" cy="128" r="2"/><circle cx="466" cy="52" r="2"/><path d="m115 181 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm427-123 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g>
  <g class="sunset-sun"><circle cx="517" cy="161" r="47" fill="#dd936c" opacity=".32"/><path d="M460 175h115m-110 10h103m-86 10h73" stroke="#22291b" stroke-width="5"/></g>
  <ellipse cx="330" cy="377" rx="200" ry="15" fill="#0f130e"/>
  <path d="m293 329-21 44m95-44 21 44M250 375h160" stroke="#798660" stroke-width="10" stroke-linecap="round"/>
  <circle cx="330" cy="208" r="143" fill="#1b2317" stroke="url(#rim)" stroke-width="13"/>
  <circle cx="330" cy="208" r="129" stroke="#39482e" stroke-width="2"/>
  <g class="wheel-spokes" stroke="#586a42" stroke-width="3" opacity=".65">
  ${Array.from({ length: 12 }, (_, i) => `<path d="M330 208v-129" transform="rotate(${i * 30} 330 208)"/>`).join('')}
  <circle cx="330" cy="208" r="126" stroke-dasharray="5 14" stroke-width="5"/>
  </g>
  <circle cx="330" cy="208" r="14" fill="#87985e"/><circle cx="330" cy="208" r="6" fill="#c7d49d"/>
  <g class="hamster">
  <path d="M259 291c-23-17-15-43-7-40 8 1-3 23 13 25" stroke="#b38159" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="320" cy="285" rx="61" ry="47" transform="rotate(-8 320 285)" fill="url(#fur)"/>
  <path d="M280 307c15-31 48-33 69-11l-7 27c-27 14-50 5-62-16Z" fill="#f2d7ab"/>
  <ellipse cx="361" cy="261" rx="45" ry="42" transform="rotate(-12 361 261)" fill="#dfb17b"/>
  <ellipse cx="338" cy="225" rx="16" ry="20" transform="rotate(-17 338 225)" fill="#dca574"/>
  <ellipse cx="338" cy="226" rx="9" ry="12" transform="rotate(-17 338 226)" fill="#d48d7c"/>
  <ellipse cx="376" cy="224" rx="15" ry="18" transform="rotate(15 376 224)" fill="#dca574"/>
  <ellipse cx="376" cy="225" rx="8" ry="10" transform="rotate(15 376 225)" fill="#d48d7c"/>
  <path d="M341 265c12-18 31-21 49-7 11 10 10 25-1 32-22 15-49 0-48-25Z" fill="#f6dfb7"/>
  <circle cx="371" cy="253" r="5.5" fill="#28291c"/><circle cx="372" cy="251" r="1.7" fill="#fff7dc"/>
  <ellipse cx="395" cy="267" rx="5" ry="3.5" fill="#b96d62"/><path d="M394 272c-3 5-6 5-9 3" stroke="#7d5840" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="367" cy="272" rx="8" ry="4" fill="#d88c78" opacity=".55"/>
  <path d="m391 278 20 2m-21 4 16 7" stroke="#d6c99f" stroke-width="1.5" stroke-linecap="round"/>
  <path d="m289 317-6 14h23m37-17 13 13 19-4" stroke="#e8b98c" stroke-width="11" stroke-linecap="round"/>
  <path d="m366 290 17 12 15-7" stroke="#e6ba88" stroke-width="9" stroke-linecap="round"/>
  </g>
  <g class="scene-plants" stroke="#71894d" stroke-width="3" stroke-linecap="round"><path d="M117 371v-48m0 31c-23 0-30-14-28-21 20-1 28 8 28 21Zm0-16c21-1 29-19 26-26-20 1-26 13-26 26ZM508 372v-67m0 42c-23 0-30-14-28-21 20-1 28 8 28 21Zm0-19c21-1 29-19 26-26-20 1-26 13-26 26Z" fill="#526437"/>
  <g transform="translate(508 295)"><g fill="#e8be5f" stroke="none">${Array.from({ length: 8 }, (_, i) => `<ellipse cy="-14" rx="6" ry="10" transform="rotate(${i * 45})"/>`).join('')}</g><circle r="10" fill="#4e3a24" stroke="none"/><circle r="5" fill="#826139" stroke="none"/></g></g>
  <g fill="#809252"><path d="m168 374-7-24 16 17 5-29 8 36Zm282 0 6-24 5 15 12-19-4 28Z"/></g>
  <g class="music-notes" fill="#c4e781"><path d="M162 154v-27l20-5v24l-4 1v-19l-12 3v22c0 9-14 11-14 4 0-5 6-7 10-3Z"/><path d="M498 226v-24l15 7v6l-11-6v16c0 9-13 11-13 4 0-5 5-7 9-3Z"/></g>
  </svg>`;
}
