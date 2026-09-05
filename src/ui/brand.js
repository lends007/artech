/**
 * ARTECH — identidade da marca.
 *
 * Recriação vetorial do símbolo e do logotipo, para que a marca escale sem
 * perda e assuma as cores corretas sobre o fundo escuro da plataforma.
 */

let n = 0;
const uid = (p) => `${p}${++n}`;

/**
 * Símbolo ARTECH: o "A" formado por uma fita dobrada — perna esquerda em
 * azul-petróleo, perna direita em ciano com o gancho inferior, e o
 * paralelogramo central como contraforma.
 */
export function artechMark(size = 40, { flat = false } = {}) {
  const gL = uid('agl'), gR = uid('agr'), gC = uid('agc');
  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" fill="none"
    role="img" aria-label="ARTECH" style="display:block">
    <defs>
      <linearGradient id="${gL}" x1="10" y1="180" x2="120" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#12293F"/><stop offset="100%" stop-color="#33678C"/>
      </linearGradient>
      <linearGradient id="${gR}" x1="180" y1="186" x2="106" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#0A87A2"/><stop offset="48%" stop-color="#14BDD6"/>
        <stop offset="100%" stop-color="#3BE6F0"/>
      </linearGradient>
      <linearGradient id="${gC}" x1="58" y1="160" x2="142" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#12304C"/><stop offset="100%" stop-color="#2E668E"/>
      </linearGradient>
    </defs>

    <!-- perna esquerda -->
    <path d="M88 20 L10 180 L50 180 L120 36 Z"
      fill="${flat ? 'currentColor' : `url(#${gL})`}" ${flat ? 'opacity=".7"' : ''}/>

    <!-- perna direita: a fita dobra sobre o ápice e fecha no gancho inferior -->
    <path d="M80 36 L86 26 L114 18 L188 170 Q196 188 176 192 Q154 195 147 178 Z"
      fill="${flat ? 'currentColor' : `url(#${gR})`}"/>

    <!-- contraforma central, à frente da fita -->
    <path d="M58 160 L96 96 L142 96 L104 160 Z"
      fill="${flat ? 'currentColor' : `url(#${gC})`}" ${flat ? 'opacity=".5"' : ''}/>
  </svg>`;
}

/**
 * Logotipo completo (símbolo + ARTECH + assinatura).
 * @param {{size?:number, tagline?:boolean, tone?:'light'|'dark'}} o
 */
export function artechLogo({ size = 34, tagline = true, tone = 'light' } = {}) {
  const tx = tone === 'light' ? 'var(--tx-hi)' : '#12283C';
  const sub = tone === 'light' ? 'var(--tx-dim)' : '#64748B';
  return `<div class="artech-logo" style="--al-tx:${tx};--al-sub:${sub}">
    <span class="al-mark">${artechMark(size)}</span>
    <span class="al-tx">
      <span class="al-name" style="font-size:${size * 0.56}px">ARTECH</span>
      ${tagline ? `<span class="al-tag" style="font-size:${Math.max(7.5, size * 0.2)}px">
        <i></i>Tecnologia que transforma<i></i></span>` : ''}
    </span>
  </div>`;
}
