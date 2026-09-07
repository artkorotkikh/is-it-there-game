/** Shared header markup; each mode binds its own audio and account lifecycle. */
export function masthead(){
  return `<header class="masthead"><a class="wordmark" href="./" aria-label="IS IT THERE YET? home"><img class="app-logo" src="/favicon.svg?v=0.4.3" width="38" height="38" alt=""> <span class="wordmark-full">PROBABLY WORKS / DELIVERY DEPARTMENT</span><span class="wordmark-short">IS IT THERE YET?</span></a><div class="audio-controls"><button id="music-toggle" class="sound-button" aria-pressed="true">♫ Music on</button><button id="effects-toggle" class="sound-button" aria-pressed="true">◖ Sound on</button></div><button id="account-toggle" class="sound-button" title="Internet Identity account" disabled>Sign in · Internet Identity</button></header>`;
}

export function modeSwitch(active:'solo'|'coop'){
  const person='<circle cx="9" cy="6" r="3"/><path d="M3 17v-2a6 6 0 0 1 12 0v2Z"/>';
  const crew='<circle cx="6" cy="6" r="3"/><circle cx="15" cy="6" r="3"/><path d="M0 17v-2a6 6 0 0 1 12 0v2Zm13 0v-2a8 8 0 0 0-2-5 6 6 0 0 1 10 5v2Z"/>';
  return `<nav class="mode-switch" aria-label="Game mode"><a href="./"${active==='solo'?' aria-current="page"':''}><svg viewBox="0 0 21 20" aria-hidden="true">${person}</svg>Solo</a><a href="?mode=expedition"${active==='coop'?' aria-current="page"':''}><svg viewBox="0 0 21 20" aria-hidden="true">${crew}</svg>Co-op</a></nav>`;
}
