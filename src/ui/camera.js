/**
 * PET CONTROL — Camera surface for the facial-identification experience.
 *
 * MVP scope: the biometric matching is SIMULATED against registered employees.
 * The camera itself is real when the browser grants access; otherwise we render
 * a synthetic feed so the demo never depends on hardware or permissions.
 */

import { rnd } from '../util.js';

let sharedStream = null;

/** Try the real webcam; fall back silently. */
export async function requestStream() {
  if (sharedStream) return sharedStream;
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
    });
    return sharedStream;
  } catch { return null; }
}

export function releaseStream() {
  sharedStream?.getTracks().forEach((t) => t.stop());
  sharedStream = null;
}

/**
 * Attach a feed to a container. Returns a stop() function.
 * @param {HTMLElement} box
 */
export async function attachFeed(box) {
  const stream = await requestStream();
  if (stream) {
    const v = document.createElement('video');
    v.autoplay = true; v.muted = true; v.playsInline = true;
    v.srcObject = stream;
    box.prepend(v);
    return () => { v.remove(); };
  }
  return syntheticFeed(box);
}

/**
 * Synthetic "thermal-ish" camera feed: drifting scan bands + sensor grain.
 * Reads as equipment output rather than a broken video element.
 */
function syntheticFeed(box) {
  const c = document.createElement('canvas');
  c.className = 'feed';
  c.width = 320; c.height = 240;
  box.prepend(c);
  const ctx = c.getContext('2d');
  let raf, t = 0;
  const blobs = Array.from({ length: 5 }, () => ({
    x: rnd(0.2, 0.8), y: rnd(0.2, 0.8), r: rnd(0.15, 0.4), s: rnd(0.0004, 0.0016), p: rnd(0, 6.28),
  }));

  const draw = () => {
    t += 1;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#0B141A'); g.addColorStop(1, '#060A0E');
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);

    /* soft silhouette so the face frame has something to sit on */
    const cx = c.width / 2 + Math.sin(t * 0.006) * 5;
    const cy = c.height * 0.52 + Math.cos(t * 0.005) * 4;
    const rg = ctx.createRadialGradient(cx, cy, 8, cx, cy, 84);
    rg.addColorStop(0, 'rgba(34,211,238,.16)');
    rg.addColorStop(.55, 'rgba(34,211,238,.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(cx, cy, 62, 82, 0, 0, 6.29); ctx.fill();

    for (const b of blobs) {
      b.p += b.s * 60;
      const x = (b.x + Math.sin(b.p) * 0.05) * c.width;
      const y = (b.y + Math.cos(b.p * 0.8) * 0.05) * c.height;
      const r = b.r * 90;
      const rr = ctx.createRadialGradient(x, y, 0, x, y, r);
      rr.addColorStop(0, 'rgba(96,165,250,.05)');
      rr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    }

    /* sensor grain */
    ctx.fillStyle = 'rgba(255,255,255,.028)';
    for (let i = 0; i < 220; i++) {
      ctx.fillRect(Math.random() * c.width | 0, Math.random() * c.height | 0, 1, 1);
    }
    raf = requestAnimationFrame(draw);
  };
  draw();
  return () => { cancelAnimationFrame(raf); c.remove(); };
}

/** Landmark mesh overlay — 24 points with a light triangulation. */
export function meshSVG() {
  const pts = [
    [38, 30], [50, 26], [62, 30], [30, 40], [70, 40], [26, 52], [74, 52],
    [38, 44], [62, 44], [42, 46], [58, 46], [50, 50], [50, 58],
    [44, 63], [56, 63], [50, 66], [34, 64], [66, 64], [30, 72], [70, 72],
    [40, 76], [60, 76], [50, 79], [50, 86],
  ];
  const links = [[0,1],[1,2],[0,3],[2,4],[3,5],[4,6],[7,9],[8,10],[9,11],[10,11],[11,12],[12,13],[12,14],[13,15],[14,15],[5,16],[6,17],[16,18],[17,19],[18,20],[19,21],[20,22],[21,22],[22,23],[13,20],[14,21],[0,7],[2,8]];
  const L = links.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}"/>`).join('');
  const C = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i % 5 === 0 ? 1.1 : .75}"/>`).join('');
  return `<svg class="mesh" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${L}${C}</svg>`;
}
