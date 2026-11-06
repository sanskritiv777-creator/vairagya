import { useEffect, useRef, useState } from "react";

/**
 * VairagyaIntro — three full-screen onboarding slides with all their motion:
 *   1. own less. know more.   (spinning coin)
 *   2. stay level.            (balance scale)
 *   3. in. out. clear.        (ink)  + "Get started" button
 *
 * Self-contained: no Tailwind, no extra packages.
 * Usage:  <VairagyaIntro onGetStarted={() => navigate("/signup")} />
 * Props: theme = "dark" (default) | "light"; showToggle = true shows a small DARK / LIGHT switch.
 * Swipe up / down to move between slides (snaps), dots on the right.
 * Only slides that are on screen are animated, so it stays light on battery.
 */

const CSS = `
.vi-wrap{position:relative;width:100%;height:100dvh;max-width:calc(100dvh * 9 / 19.5);margin:0 auto;background:#101114;overflow:hidden;container-type:inline-size;user-select:none;-webkit-user-select:none}
.vi-scroll{height:100%;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.vi-scroll::-webkit-scrollbar{display:none}
.vi-snap{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always}
.vi-slide{position:absolute;inset:0;overflow:hidden;background:#101114}
.vi-st{position:absolute;inset:0;touch-action:pan-y}
.vi-cv{position:absolute;inset:0;width:100%;height:100%;display:block;transform:scale(1.08);transition:transform 1.4s cubic-bezier(.2,.7,.2,1)}
.vi-on .vi-cv{transform:none}
.vi-h1{position:absolute;top:11%;left:0;right:0;margin:0;text-align:center;font-family:'DM Serif Display',Georgia,serif;font-weight:400;color:#F0E8DC;font-size:60px;font-size:clamp(40px,17cqw,84px);line-height:.95;letter-spacing:-.035em;pointer-events:none;text-shadow:0 2px 30px rgba(16,17,20,.3);opacity:0;transform:translateY(22px);transition:opacity .9s .15s ease,transform .9s .15s cubic-bezier(.2,.7,.2,1)}
.vi-on .vi-h1{opacity:1;transform:none}
.vi-hint{position:absolute;bottom:calc(24px + env(safe-area-inset-bottom,0px));left:0;right:0;text-align:center;font:700 11px Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#F0E8DC;pointer-events:none;opacity:0;transition:opacity .9s .5s ease}
.vi-on .vi-hint{opacity:.75}
.vi-lab{position:absolute;bottom:calc(24px + env(safe-area-inset-bottom,0px));font:700 11px Manrope,sans-serif;letter-spacing:.22em;color:#F0E8DC;opacity:.85;pointer-events:none}
.vi-l{left:22px}.vi-r{right:22px}
.vi-cta{position:absolute;left:50%;bottom:calc(66px + env(safe-area-inset-bottom,0px));transform:translate(-50%,16px);font:700 13px Manrope,sans-serif;letter-spacing:.26em;color:#F0E8DC;background:rgba(16,17,20,.7);border:1px solid rgba(240,232,220,.5);padding:18px 30px;cursor:pointer;border-radius:0;white-space:nowrap;opacity:0;transition:opacity .9s .7s ease,transform .9s .7s cubic-bezier(.2,.7,.2,1),border-color .2s,color .2s}
.vi-on .vi-cta{opacity:1;transform:translate(-50%,0)}
.vi-cta:active{border-color:#8B7BB8;color:#8B7BB8}
.vi-dots{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;z-index:4}
.vi-dot{width:6px;height:6px;padding:0;border:0;border-radius:3px;background:#F0E8DC;opacity:.35;cursor:pointer;transition:height .4s,opacity .4s}
.vi-dot.vi-d-on{height:20px;opacity:1}
.vi-tg{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:5}
.vi-tg button{font:700 11px Manrope,sans-serif;padding:7px 14px;border:1px solid #F0E8DC;border-radius:3px;cursor:pointer;letter-spacing:.1em}
.vi-cue{position:absolute;left:0;right:0;bottom:calc(50px + env(safe-area-inset-bottom,0px));text-align:center;font:700 10px Manrope,sans-serif;letter-spacing:.22em;color:#F0E8DC;pointer-events:none;z-index:3;animation:vi-bob 1.9s ease-in-out infinite}
.vi-wrap.vi-light .vi-h1,.vi-wrap.vi-light .vi-hint,.vi-wrap.vi-light .vi-lab,.vi-wrap.vi-light .vi-cue{color:#1B1826;text-shadow:none}
.vi-wrap.vi-light .vi-cta{color:#1B1826;background:rgba(255,255,255,.68);border-color:rgba(27,24,38,.32)}
.vi-wrap.vi-light .vi-cta:active{border-color:#6E5FA8;color:#6E5FA8}
.vi-wrap.vi-light .vi-dot{background:#1B1826}
.vi-wrap.vi-light .vi-tg button{border-color:#6E5FA8}
@keyframes vi-bob{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:.8;transform:translateY(-5px)}}
@media (prefers-reduced-motion:reduce){.vi-cv{transform:none;transition:none}.vi-h1,.vi-hint,.vi-cta{opacity:1;transform:none;transition:none}.vi-cta{transform:translate(-50%,0)}.vi-cue{animation:none}}
`;

/* ---------- shared canvas plumbing ---------- */

type Ctl = { draw: (dt: number) => void; dispose: () => void };
type Init = (cv: HTMLCanvasElement, st: HTMLDivElement, x: CanvasRenderingContext2D) => Ctl;
const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCanvasSlide(play: boolean, init: Init, dep?: unknown) {
  const stRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<{ play: () => void; pause: () => void } | null>(null);
  const playRef = useRef(play);
  playRef.current = play;
  const drawRef = useRef<((dt: number) => void) | null>(null);

  useEffect(() => {
    const st = stRef.current!;
    const cv = cvRef.current!;
    const x = cv.getContext("2d")!;
    const { draw, dispose } = init(cv, st, x);
    drawRef.current = draw;
    let raf = 0, last = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const ctl = {
      play() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } },
      pause() { cancelAnimationFrame(raf); raf = 0; },
    };
    loopRef.current = ctl;
    const ro = new ResizeObserver(() => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = w * d; cv.height = h * d;
      x.setTransform(d, 0, 0, d, 0, 0);
      draw(0);
    });
    ro.observe(cv);
    if (!reduce() && playRef.current) ctl.play();
    return () => { ctl.pause(); ro.disconnect(); dispose(); loopRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduce()) return;
    if (play) loopRef.current?.play(); else loopRef.current?.pause();
  }, [play]);

  useEffect(() => { drawRef.current?.(0); }, [dep]);

  return { stRef, cvRef };
}

type SlideProps = { play: boolean; on: boolean; mode: Mode };
const cl = (v: number) => Math.max(0, Math.min(1, v));
const TAU = 6.283185;
const K = { mid: "#101114", gr: "#191A20", pl: "#24232D", iv: "#F0E8DC", lav: "#8B7BB8", jade: "#4D9F91", cor: "#E66B67" };

type Mode = "dark" | "light";
const TH = {
  dark: { b0: "#24232D", b1: "#191A20", b2: "#101114", page: "#101114", gm: 0.5, gi: 0.34, wash: "139,123,184", washA: 0.3, ig: 0.35, ia0: 0.26, ia1: 0.1 },
  light: { b0: "#FFFFFF", b1: "#F5F4F8", b2: "#EDEBF2", page: "#F5F4F8", gm: 0.16, gi: 0.09, wash: "110,95,168", washA: 0.13, ig: 0.3, ia0: 0.14, ia1: 0.06 },
};

function bgFill(x: CanvasRenderingContext2D, w: number, h: number, m: Mode) {
  const c = TH[m];
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.b0); g.addColorStop(0.6, c.b1); g.addColorStop(1, c.b2);
  x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, 0, w, h);
}

/* ---------- slide 1: coin ---------- */

type Spark = { x: number; y: number; vx: number; vy: number; l: number; c: string };
const PILLS: [string, number][] = [
  ["+\u20B918,000", 1], ["\u2212\u20B9240", 0], ["+\u20B96,500", 1],
  ["\u2212\u20B99,500", 0], ["\u2212\u20B960", 0], ["+\u20B91,200", 1],
];

function CoinSlide({ play, on, mode }: SlideProps) {
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { stRef, cvRef } = useCanvasSlide(play, (cv, st, x) => {
    let t = 0, a = 0.6, av = 1.1, drag = false, lastX = 0, lastT = 0, moved = 0, downT = 0;
    const parts: Spark[] = [];
    const onDown = (e: PointerEvent) => { drag = true; lastX = e.clientX; lastT = e.timeStamp; moved = 0; downT = performance.now(); };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - lastX, dt = Math.max(0.008, (e.timeStamp - lastT) / 1000);
      a += dx * 0.014; moved += Math.abs(dx); av = av * 0.6 + ((dx * 0.014) / dt) * 0.4;
      lastX = e.clientX; lastT = e.timeStamp;
    };
    const onUp = () => {
      if (!drag) return;
      drag = false;
      if (moved < 8 && performance.now() - downT < 320) av += 13 * Math.sign(av || 1);
      av = Math.max(-26, Math.min(26, av));
    };
    const onCancel = () => { drag = false; };
    st.addEventListener("pointerdown", onDown);
    st.addEventListener("pointermove", onMove);
    st.addEventListener("pointerup", onUp);
    st.addEventListener("pointercancel", onCancel);

    let R = 0, cx = 0, cy = 0, T = 0;
    const ell = (px: number, py: number, rx: number, ry: number) => { x.beginPath(); x.ellipse(px, py, Math.max(rx, 0.5), ry, 0, 0, TAU); };
    const glow = (gx: number, gy: number, r: number, c: string, al: number) => {
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, "rgba(" + c + "," + al + ")"); g.addColorStop(1, "rgba(" + c + ",0)");
      x.fillStyle = g; x.fillRect(gx - r, gy - r, r * 2, r * 2);
    };
    const pillPos = (i: number) => {
      const th = t * (0.5 + Math.min(1, Math.abs(av) / 10) * 0.5) + (i * TAU) / PILLS.length, rho = R * 1.62;
      const ex = rho * Math.cos(th), ey = rho * 0.3 * Math.sin(th), ph = -0.16;
      return { x: cx + ex * Math.cos(ph) - ey * Math.sin(ph), y: cy + ex * Math.sin(ph) + ey * Math.cos(ph), front: Math.sin(th) > 0, d: Math.sin(th) };
    };
    const pills = (front: boolean) => {
      PILLS.forEach((p, i) => {
        const q = pillPos(i);
        if (q.front !== front) return;
        const sc = 0.88 + 0.12 * q.d;
        x.save(); x.globalAlpha = front ? 1 : 0.6; x.translate(q.x, q.y); x.scale(sc, sc);
        x.font = "700 14px Manrope,sans-serif";
        const tw = x.measureText(p[0]).width, pw = tw + 24, ph = 28;
        x.fillStyle = p[1] ? K.jade : K.cor;
        x.beginPath(); (x as any).roundRect(-pw / 2, -ph / 2, pw, ph, 3); x.fill();
        x.fillStyle = K.iv; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(p[0], 0, 1);
        x.restore();
      });
    };
    const coin = () => {
      const c = Math.cos(a), s = Math.sin(a), ac = Math.abs(c), sg = c >= 0 ? 1 : -1;
      const ew = R * ac, half = (T / 2) * s * sg, LAY = 16;
      for (let k = 0; k <= LAY; k++) {
        const f = k / LAY, px = cx - half + 2 * half * f;
        x.fillStyle = k % 2 ? "#101114" : "#24232D";
        ell(px, cy, ew, R); x.fill();
      }
      const fx = cx + half;
      const sp = 0.5 + 0.5 * Math.sin(a * 1.3 + 0.4);
      const g = x.createLinearGradient(fx - ew, 0, fx + ew, 0);
      const lo = cl(sp - 0.2), hi = cl(sp + 0.2);
      g.addColorStop(0, "#24232D"); g.addColorStop(lo, "#2c2a3b"); g.addColorStop(sp, "#5f5486"); g.addColorStop(hi, "#2c2a3b"); g.addColorStop(1, "#15151b");
      x.fillStyle = g; ell(fx, cy, ew, R); x.fill();
      x.save(); ell(fx, cy, ew, R); x.clip();
      const tn = x.createLinearGradient(fx - ew, 0, fx + ew, 0);
      tn.addColorStop(0, "rgba(77,159,145,.26)"); tn.addColorStop(0.38, "rgba(77,159,145,0)"); tn.addColorStop(0.62, "rgba(230,107,103,0)"); tn.addColorStop(1, "rgba(230,107,103,.26)");
      x.fillStyle = tn; x.fillRect(fx - ew, cy - R, ew * 2, R * 2); x.restore();
      if (ac > 0.05) {
        x.strokeStyle = "#101114"; x.lineWidth = 4; ell(fx, cy, ew, R); x.stroke();
        x.strokeStyle = "rgba(139,123,184,.85)"; x.lineWidth = 2; ell(fx, cy, ew * 0.86, R * 0.86); x.stroke();
        x.strokeStyle = "rgba(240,232,220,.18)"; x.lineWidth = 1; ell(fx, cy, ew * 0.8, R * 0.8); x.stroke();
        x.save(); x.translate(fx, cy); x.scale(Math.max(ac, 0.02), 1);
        x.font = "700 " + R * 1.15 + 'px "Space Grotesk",sans-serif'; x.textAlign = "center"; x.textBaseline = "middle";
        const glyph = c >= 0 ? "\u20B9" : "V";
        x.fillStyle = "rgba(16,17,20,.7)"; x.fillText(glyph, 2, R * 0.06 + 2);
        x.fillStyle = "#F0E8DC"; x.fillText(glyph, 0, R * 0.06);
        x.restore();
      }
    };

    const draw = (dt: number) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      t += dt;
      if (!drag) { a += av * dt; av += (Math.sign(av || 1) * 1.1 - av) * Math.min(1, dt * 0.7); }
      R = Math.min(w * 0.27, h * 0.17); cx = w / 2; cy = h * 0.58; T = R * 0.17;
      const spd = cl(Math.abs(av) / 10);
      bgFill(x, w, h, modeRef.current);
      glow(cx - R * 1.3, cy, R * 1.9, "77,159,145", TH[modeRef.current].gm + 0.3 * spd);
      glow(cx + R * 1.3, cy, R * 1.9, "230,107,103", TH[modeRef.current].gm + 0.3 * spd);
      glow(cx, cy, R * 2.2, "139,123,184", TH[modeRef.current].gi);
      const g = x.createRadialGradient(cx, cy + R * 1.3, 0, cx, cy + R * 1.3, R * 1.2);
      g.addColorStop(0, "rgba(16,17,20,.4)"); g.addColorStop(1, "rgba(16,17,20,0)");
      x.save(); x.translate(0, cy + R * 1.3); x.scale(1, 0.22); x.translate(0, -(cy + R * 1.3));
      x.fillStyle = g; x.fillRect(cx - R * 1.3, cy, R * 2.6, R * 2.6); x.restore();
      pills(false);
      coin();
      pills(true);
      if (spd > 0.25) {
        const n = Math.floor(spd * dt * 120 + Math.random());
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          parts.push({ x: cx + side * R * Math.abs(Math.cos(a)), y: cy + (Math.random() - 0.5) * R * 1.6, vx: side * (40 + Math.random() * 160), vy: -30 + Math.random() * -60, l: 0, c: side < 0 ? K.jade : K.cor });
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.l += dt;
        if (p.l > 0.9) { parts.splice(i, 1); continue; }
        p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        x.globalAlpha = 1 - p.l / 0.9; x.fillStyle = p.c; x.fillRect(p.x, p.y, 2.5, 2.5);
      }
      x.globalAlpha = 1;
    };
    const dispose = () => {
      st.removeEventListener("pointerdown", onDown);
      st.removeEventListener("pointermove", onMove);
      st.removeEventListener("pointerup", onUp);
      st.removeEventListener("pointercancel", onCancel);
    };
    return { draw, dispose };
  }, mode);

  return (
    <section className={"vi-slide" + (on ? " vi-on" : "")} style={{ background: TH[mode].page }}>
      <div className="vi-st" ref={stRef}>
        <canvas className="vi-cv" ref={cvRef} role="img" aria-label="A spinning dark coin with orbiting jade and coral amounts" />
      </div>
      <h1 className="vi-h1">own less.<br />know more.</h1>
      <div className="vi-hint">drag to spin · tap to flip</div>
    </section>
  );
}

/* ---------- slide 2: level ---------- */

type Blk = { amt: number; age: number; y: number; landed: boolean };

function LevelSlide({ play, on, mode }: SlideProps) {
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { stRef, cvRef } = useCanvasSlide(play, (cv, st, x) => {
    let t = 0, th = 0, om = 0, idle = 0, autoT = 0, netShow = 0;
    const S: { L: Blk[]; R: Blk[] } = { L: [], R: [] };
    const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString("en-IN");
    const add = (side: "L" | "R", amt: number) => {
      const arr = S[side];
      arr.push({ amt, age: 0, y: 0, landed: false });
      if (arr.length > 6) arr.shift();
    };
    const wt = (side: "L" | "R") => S[side].reduce((sum, b) => sum + (b.landed ? b.amt : 0), 0);
    const isStill = reduce();
    if (isStill) {
      [1800, 2400, 900].forEach((v) => add("L", v));
      [1500, 1700].forEach((v) => add("R", v));
      S.L.concat(S.R).forEach((b) => { b.age = 9; b.landed = true; });
    }

    let dn: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => { dn = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      if (!dn) return;
      const d = Math.hypot(e.clientX - dn.x, e.clientY - dn.y);
      if (d < 10 && performance.now() - dn.t < 450) {
        const r = st.getBoundingClientRect();
        add(e.clientX - r.left < r.width / 2 ? "L" : "R", 600 + Math.floor(Math.random() * 3400));
        idle = 0;
      }
      dn = null;
    };
    const onCancel = () => { dn = null; };
    st.addEventListener("pointerdown", onDown);
    st.addEventListener("pointerup", onUp);
    st.addEventListener("pointercancel", onCancel);

    const block = (cx: number, top: number, bw: number, b: Blk, col: string) => {
      const bh = 14 + (b.amt / 3600) * 26;
      const fall = Math.pow(1 - cl(b.age / 0.45), 2) * 260;
      const ty = top - b.y - bh - fall;
      x.fillStyle = col; x.fillRect(cx - bw / 2, ty, bw, bh);
      x.fillStyle = "rgba(240,232,220,.22)"; x.fillRect(cx - bw / 2, ty, bw, 2);
    };

    const draw = (dt: number) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      t += dt; idle += dt; autoT += dt;
      if (!isStill && idle > 2.4 && autoT > 1.7) {
        autoT = 0;
        add(wt("L") <= wt("R") ? "L" : "R", 600 + Math.floor(Math.random() * 3400));
      }
      (["L", "R"] as const).forEach((k) =>
        S[k].forEach((b) => {
          b.age += dt;
          if (!b.landed && b.age >= 0.45) { b.landed = true; om += (k === "L" ? -1 : 1) * 0.5; }
        })
      );
      const WL = wt("L"), WR = wt("R"), net = WL - WR;
      netShow += (net - netShow) * Math.min(1, dt * 6);
      const target = Math.max(-0.4, Math.min(0.4, ((WR - WL) / 5000) * 0.14));
      om += ((target - th) * 70 - om * 7) * dt; th += om * dt;

      const cx = w / 2, cy = h * 0.5, L = w * 0.36, hang = h * 0.075, pw = w * 0.27;
      bgFill(x, w, h, modeRef.current);
      const g = x.createRadialGradient(cx, cy + h * 0.12, 0, cx, cy + h * 0.12, h * 0.55);
      const wc = TH[modeRef.current].wash;
      g.addColorStop(0, "rgba(" + wc + "," + TH[modeRef.current].washA + ")"); g.addColorStop(1, "rgba(" + wc + ",0)");
      x.fillStyle = g; x.fillRect(0, 0, w, h);

      const baseY = h * 0.78;
      x.fillStyle = K.iv; x.fillRect(cx - 2, cy, 4, baseY - cy); x.fillRect(cx - w * 0.14, baseY, w * 0.28, 5);
      const lx = cx - L * Math.cos(th), ly = cy - L * Math.sin(th), rx = cx + L * Math.cos(th), ry = cy + L * Math.sin(th);
      x.strokeStyle = K.iv; x.lineWidth = 6; x.lineCap = "butt";
      x.beginPath(); x.moveTo(lx, ly); x.lineTo(rx, ry); x.stroke();

      const sides: ["L" | "R", number, number, string][] = [["L", lx, ly, K.jade], ["R", rx, ry, K.cor]];
      sides.forEach(([k, ex, ey, col]) => {
        const py = ey + hang;
        x.strokeStyle = "rgba(240,232,220,.55)"; x.lineWidth = 1.2; x.beginPath();
        x.moveTo(ex, ey); x.lineTo(ex - pw / 2, py); x.moveTo(ex, ey); x.lineTo(ex + pw / 2, py); x.stroke();
        let acc = 0;
        S[k].forEach((b) => {
          const bh = 14 + (b.amt / 3600) * 26;
          b.y += (acc - b.y) * Math.min(1, dt * 12);
          if (b.age < 0.05) b.y = acc;
          block(ex, py, pw * 0.7, b, col);
          acc += bh + 3;
        });
        x.fillStyle = K.iv; x.fillRect(ex - pw / 2, py, pw, 6);
        x.beginPath(); x.arc(ex, ey, 5, 0, TAU); x.fill();
      });
      x.fillStyle = K.iv; x.beginPath(); x.arc(cx, cy, 13, 0, TAU); x.fill();
      x.fillStyle = K.pl; x.beginPath(); x.arc(cx, cy, 4, 0, TAU); x.fill();

      x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.font = "700 11px Manrope,sans-serif"; x.fillStyle = K.iv; x.globalAlpha = 0.8; x.fillText("NET", cx, baseY + 44); x.globalAlpha = 1;
      x.font = '700 30px "Space Grotesk",sans-serif';
      x.fillStyle = Math.abs(netShow) < 1 ? K.iv : netShow > 0 ? K.jade : K.cor;
      x.fillText((netShow >= 0 ? "+" : "\u2212") + "\u20B9" + fmt(netShow), cx, baseY + 76);
    };
    const dispose = () => {
      st.removeEventListener("pointerdown", onDown);
      st.removeEventListener("pointerup", onUp);
      st.removeEventListener("pointercancel", onCancel);
    };
    return { draw, dispose };
  }, mode);

  return (
    <section className={"vi-slide" + (on ? " vi-on" : "")} style={{ background: TH[mode].page }}>
      <div className="vi-st" ref={stRef}>
        <canvas className="vi-cv" ref={cvRef} role="img" aria-label="A balance scale: tap the left to add money in, the right to add money out" />
      </div>
      <h1 className="vi-h1">stay<br />level.</h1>
      <div className="vi-hint">tap left · money in &nbsp;|&nbsp; tap right · money out</div>
    </section>
  );
}

/* ---------- slide 3: ink ---------- */

type Blob = { jade: boolean; hx: number; hy: number; r: number; x: number; y: number; vx: number; vy: number; p: number; f: number; init: boolean };

function InkSlide({ play, on, mode, onGetStarted, ctaLabel }: SlideProps & { onGetStarted?: () => void; ctaLabel: string }) {
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { stRef, cvRef } = useCanvasSlide(play, (cv, st, x) => {
    let s = 21;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const B: Blob[] = [];
    for (let i = 0; i < 60; i++) {
      const jade = i % 2 === 0;
      B.push({ jade, hx: jade ? 0.1 + rnd() * 0.32 : 0.58 + rnd() * 0.32, hy: 0.4 + rnd() * 0.5, r: 0.17 + rnd() * 0.17, x: 0, y: 0, vx: 0, vy: 0, p: rnd() * 6.28, f: 0.6 + rnd() * 0.8, init: false });
    }
    let t = 0, down = false, px = 0, py = 0, pvx = 0, pvy = 0, boost = 0, active = false;
    const pt = (e: PointerEvent): [number, number] => {
      const r = st.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const onDown = (e: PointerEvent) => { down = active = true; [px, py] = pt(e); boost = 1; };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const [nx, ny] = pt(e);
      if (active) { pvx = pvx * 0.5 + (nx - px) * 30; pvy = pvy * 0.5 + (ny - py) * 30; }
      px = nx; py = ny; active = true;
    };
    const onEnd = () => { down = false; active = false; };
    st.addEventListener("pointerdown", onDown);
    st.addEventListener("pointermove", onMove);
    st.addEventListener("pointerup", onEnd);
    st.addEventListener("pointercancel", onEnd);

    const draw = (dt: number) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      t += dt; boost *= Math.pow(0.2, dt); pvx *= Math.pow(0.05, dt); pvy *= Math.pow(0.05, dt);
      const D = Math.pow(0.18, dt);
      for (const b of B) {
        const hx = b.hx * w + Math.sin(t * 0.35 * b.f + b.p) * w * 0.05;
        const hy = b.hy * h + Math.cos(t * 0.3 * b.f + b.p * 1.3) * h * 0.03;
        if (!b.init) { b.x = hx; b.y = hy; b.init = true; }
        b.vx += (hx - b.x) * dt * 0.9; b.vy += (hy - b.y) * dt * 0.9;
        if (active) {
          const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy) || 1, R = w * 0.55;
          if (d < R) {
            const f = 1 - d / R;
            b.vx += (pvx * f * 0.9 + (-dy / d) * f * w * (0.5 + boost * 2.4) + (dx / d) * boost * f * w * 1.2) * dt * 3;
            b.vy += (pvy * f * 0.9 + (dx / d) * f * w * (0.5 + boost * 2.4) + (dy / d) * boost * f * w * 1.2) * dt * 3;
          }
        }
        b.vx *= D; b.vy *= D; b.x += b.vx * dt; b.y += b.vy * dt;
      }
      x.globalCompositeOperation = "source-over";
      bgFill(x, w, h, modeRef.current);
      let g = x.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, h * 0.6);
      g.addColorStop(0, "rgba(139,123,184," + TH[modeRef.current].ig + ")"); g.addColorStop(1, "rgba(139,123,184,0)");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "screen";
      for (const b of B) {
        const r = b.r * w, c = b.jade ? "77,159,145" : "230,107,103";
        g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        g.addColorStop(0, "rgba(" + c + "," + TH[modeRef.current].ia0 + ")"); g.addColorStop(0.55, "rgba(" + c + "," + TH[modeRef.current].ia1 + ")"); g.addColorStop(1, "rgba(" + c + ",0)");
        x.fillStyle = g; x.fillRect(b.x - r, b.y - r, r * 2, r * 2);
      }
      x.globalCompositeOperation = "source-over";
    };
    const dispose = () => {
      st.removeEventListener("pointerdown", onDown);
      st.removeEventListener("pointermove", onMove);
      st.removeEventListener("pointerup", onEnd);
      st.removeEventListener("pointercancel", onEnd);
    };
    return { draw, dispose };
  }, mode);

  return (
    <section className={"vi-slide" + (on ? " vi-on" : "")} style={{ background: TH[mode].page }}>
      <div className="vi-st" ref={stRef}>
        <canvas className="vi-cv" ref={cvRef} role="img" aria-label="Jade and coral ink clouds that mix when touched and slowly separate again" />
      </div>
      <h1 className="vi-h1">in. out.<br />clear.</h1>
      <div className="vi-lab vi-l">MONEY IN</div>
      <div className="vi-lab vi-r">MONEY OUT</div>
      <button type="button" className="vi-cta" onClick={onGetStarted}>{ctaLabel} &nbsp;→</button>
    </section>
  );
}

/* ---------- the intro ---------- */

export default function VairagyaIntro({
  onGetStarted,
  ctaLabel = "GET STARTED",
  className,
  theme = "dark",
  showToggle = true,
}: {
  onGetStarted?: () => void;
  ctaLabel?: string;
  className?: string;
  theme?: Mode;
  showToggle?: boolean;
}) {
  const scRef = useRef<HTMLDivElement>(null);
  const secs = useRef<(HTMLDivElement | null)[]>([]);
  const [vis, setVis] = useState<boolean[]>([true, false, false]);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>(theme);
  useEffect(() => { setMode(theme); }, [theme]);

  useEffect(() => {
    if (!document.getElementById("vh-fonts")) {
      const l = document.createElement("link");
      l.id = "vh-fonts";
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@500;700&family=Space+Grotesk:wght@700&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    const sc = scRef.current!;
    const ratios = [1, 0, 0];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const i = Number((e.target as HTMLElement).dataset.i);
          ratios[i] = e.intersectionRatio;
        });
        setVis(ratios.map((r) => r > 0.08));
        setActive(ratios.indexOf(Math.max(...ratios)));
      },
      { root: sc, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    secs.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = (i: number) => {
    const sc = scRef.current;
    if (sc) sc.scrollTo({ top: i * sc.clientHeight, behavior: "smooth" });
  };

  return (
    <div className={"vi-wrap" + (mode === "light" ? " vi-light" : "") + (className ? " " + className : "")} style={{ background: TH[mode].page }}>
      <style>{CSS}</style>
      <div className="vi-scroll" ref={scRef}>
        <div className="vi-snap" data-i={0} ref={(el) => { secs.current[0] = el; }}>
          <CoinSlide play={vis[0]} on={active === 0} mode={mode} />
        </div>
        <div className="vi-snap" data-i={1} ref={(el) => { secs.current[1] = el; }}>
          <LevelSlide play={vis[1]} on={active === 1} mode={mode} />
        </div>
        <div className="vi-snap" data-i={2} ref={(el) => { secs.current[2] = el; }}>
          <InkSlide play={vis[2]} on={active === 2} mode={mode} onGetStarted={onGetStarted} ctaLabel={ctaLabel} />
        </div>
      </div>
      <div className="vi-dots" role="tablist" aria-label="Intro slides">
        {[0, 1, 2].map((i) => (
          <button key={i} type="button" aria-label={"Slide " + (i + 1)} className={"vi-dot" + (active === i ? " vi-d-on" : "")} onClick={() => go(i)} />
        ))}
      </div>
      {active < 2 && <div className="vi-cue">SWIPE UP ↑</div>}
      {showToggle && (
        <div className="vi-tg">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{ background: mode === m ? (mode === "dark" ? "#F0E8DC" : "#6E5FA8") : "rgba(16,17,20,.08)", color: mode === m ? (mode === "dark" ? "#101114" : "#FFFFFF") : (mode === "dark" ? "#F0E8DC" : "#1B1826"), opacity: mode === m ? 1 : 0.85 }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
