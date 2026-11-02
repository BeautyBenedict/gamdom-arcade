'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import s from './game.module.css';

/* ---------- constants ---------- */
const W = 800;
const H = 400;
const GROUND = 330;
const GRAVITY = 2300;
const JUMP_V = 790;
const PLAYER_X = 90;
const PLAYER_H = 96;
const PLAYER_W = PLAYER_H * (900 / 1410);
const LOOP = 1600;
const BEST_KEY = 'gamdom-arcade-runner-best';

/* ---------- types ---------- */
type ImgKey = 'gamby' | 'coin' | 'steve' | 'lady';
type Imgs = Record<ImgKey, HTMLImageElement>;
type ObsKind = 'dice' | 'chips' | 'candle';
type PickKind = 'coin' | 'steve' | 'lady';

interface Obstacle {
  kind: ObsKind;
  x: number;
  w: number;
  h: number;
}
interface Pickup {
  kind: PickKind;
  x: number;
  y: number;
}
interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
}
interface Building {
  x: number;
  w: number;
  h: number;
  seed: number;
}
interface Game {
  state: 'ready' | 'playing' | 'dying' | 'over';
  clock: number;
  t: number;
  distance: number;
  speed: number;
  scroll: number;
  py: number;
  vy: number;
  rot: number;
  squash: number;
  onGround: boolean;
  obstacles: Obstacle[];
  pickups: Pickup[];
  popups: Popup[];
  nextObs: number;
  coins: number;
  bonus: number;
  deadTimer: number;
  flash: number;
  reported: boolean;
  overAt: number;
}
interface Result {
  score: number;
  best: number;
  coins: number;
  isBest: boolean;
}

/* ---------- skyline (built once) ---------- */
function makeBuildings(seed: number, minH: number, maxH: number, minW: number, maxW: number): Building[] {
  let r = seed;
  const rnd = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const out: Building[] = [];
  let x = 0;
  while (x < LOOP) {
    const w = minW + rnd() * (maxW - minW);
    const h = minH + rnd() * (maxH - minH);
    out.push({ x, w, h, seed: Math.floor(rnd() * 1000) });
    x += w + 4 + rnd() * 10;
  }
  return out;
}
const FAR = makeBuildings(7, 110, 230, 40, 84);
const NEAR = makeBuildings(21, 70, 170, 46, 100);

/* ---------- helpers ---------- */
const ok = (im: HTMLImageElement | undefined) => !!im && im.complete && im.naturalWidth > 0;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const scoreOf = (g: Game) => Math.floor(g.distance / 12) + g.bonus;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeGame(): Game {
  return {
    state: 'ready',
    clock: 0,
    t: 0,
    distance: 0,
    speed: 330,
    scroll: 0,
    py: GROUND,
    vy: 0,
    rot: 0,
    squash: 0,
    onGround: true,
    obstacles: [],
    pickups: [],
    popups: [],
    nextObs: 520,
    coins: 0,
    bonus: 0,
    deadTimer: 0,
    flash: 0,
    reported: false,
    overAt: 0,
  };
}

/* ---------- spawning ---------- */
function spawn(g: Game) {
  const kinds: ObsKind[] = ['dice', 'chips', 'candle'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const x = W + 30;
  let totalW = 0;

  if (kind === 'dice') {
    const double = Math.random() < 0.3;
    g.obstacles.push({ kind, x, w: 40, h: 40 });
    totalW = 40;
    if (double) {
      g.obstacles.push({ kind, x: x + 42, w: 40, h: 40 });
      totalW = 82;
    }
  } else if (kind === 'chips') {
    g.obstacles.push({ kind, x, w: 46, h: 44 });
    totalW = 46;
  } else {
    g.obstacles.push({ kind, x, w: 24, h: 74 });
    totalW = 24;
  }

  if (Math.random() < 0.65) {
    const cx = x + totalW / 2;
    const bonusKind: PickKind | null = Math.random() < 0.1 ? (Math.random() < 0.5 ? 'steve' : 'lady') : null;
    for (let i = -2; i <= 2; i++) {
      const y = GROUND - 90 - (1 - (i / 2) * (i / 2)) * 55;
      const k: PickKind = i === 0 && bonusKind ? bonusKind : 'coin';
      g.pickups.push({ kind: k, x: cx + i * 36, y });
    }
  }

  g.nextObs = totalW + g.speed * 0.69 * 1.15 + 150 + Math.random() * 220;
}

/* ---------- update ---------- */
function update(g: Game, dt: number) {
  g.clock += dt;

  const scrollSpeed =
    g.state === 'playing' ? g.speed : g.state === 'ready' ? 70 : g.state === 'dying' ? g.speed * 0.25 : 0;
  g.scroll += scrollSpeed * dt;

  g.popups.forEach((p) => {
    p.y -= 40 * dt;
    p.life -= dt;
  });
  g.popups = g.popups.filter((p) => p.life > 0);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2);

  if (g.state === 'ready') {
    g.rot = Math.sin(g.clock * 3) * 0.03;
    return;
  }

  if (g.state === 'dying') {
    g.vy += GRAVITY * dt;
    g.py += g.vy * dt;
    g.rot += 12 * dt;
    g.deadTimer += dt;
    if (g.deadTimer > 0.9) g.state = 'over';
    return;
  }

  if (g.state !== 'playing') return;

  g.t += dt;
  g.speed = Math.min(660, 330 + g.t * 8);
  g.distance += g.speed * dt;

  if (!g.onGround) {
    g.vy += GRAVITY * dt;
    g.py += g.vy * dt;
    if (g.py >= GROUND) {
      g.py = GROUND;
      g.vy = 0;
      g.onGround = true;
      g.squash = 1;
    }
    g.rot = (g.vy / JUMP_V) * 0.2;
  } else {
    g.rot = Math.sin(g.clock * 16) * 0.09;
  }
  g.squash = Math.max(0, g.squash - dt * 6);

  g.nextObs -= g.speed * dt;
  if (g.nextObs <= 0) spawn(g);

  const dx = g.speed * dt;
  g.obstacles.forEach((o) => (o.x -= dx));
  g.pickups.forEach((p) => (p.x -= dx));
  g.obstacles = g.obstacles.filter((o) => o.x + o.w > -20);
  g.pickups = g.pickups.filter((p) => p.x > -40);

  // player hitbox
  const hx = PLAYER_X + 16;
  const hy = g.py - PLAYER_H + 14;
  const hw = PLAYER_W - 32;
  const hh = PLAYER_H - 20;

  // pickups
  g.pickups = g.pickups.filter((p) => {
    const r = p.kind === 'coin' ? 15 : 22;
    const hit = p.x > hx - r && p.x < hx + hw + r && p.y > hy - r && p.y < hy + hh + r;
    if (!hit) return true;
    if (p.kind === 'coin') {
      g.coins += 1;
      g.bonus += 10;
      g.popups.push({ text: '+10', x: p.x, y: p.y - 10, life: 0.7 });
    } else {
      g.bonus += 50;
      g.popups.push({
        text: p.kind === 'steve' ? '+50 Steve bonus!' : '+50 Lady Gamdom!',
        x: p.x - 40,
        y: p.y - 14,
        life: 1.2,
      });
    }
    return false;
  });

  // obstacles
  for (const o of g.obstacles) {
    const inset = o.kind === 'candle' ? 6 : 4;
    const ox = o.x + inset;
    const ow = o.w - inset * 2;
    const oy = GROUND - o.h + 4;
    const oh = o.h - 4;
    if (hx < ox + ow && hx + hw > ox && hy < oy + oh && hy + hh > oy) {
      g.state = 'dying';
      g.vy = -480;
      g.flash = 1;
      g.deadTimer = 0;
      break;
    }
  }
}

/* ---------- drawing ---------- */
function drawLayer(
  ctx: CanvasRenderingContext2D,
  list: Building[],
  off: number,
  color: string,
  windows: string | null,
) {
  const o = off % LOOP;
  for (let k = 0; k < 2; k++) {
    for (const b of list) {
      const x = b.x - o + k * LOOP;
      if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, GROUND - b.h, b.w, b.h);
      if (windows) {
        ctx.fillStyle = windows;
        const cols = Math.floor((b.w - 8) / 14);
        const rows = Math.floor((b.h - 12) / 18);
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if ((b.seed * 31 + i * 17 + j * 29) % 7 === 0) {
              ctx.fillRect(x + 6 + i * 14, GROUND - b.h + 10 + j * 18, 6, 8);
            }
          }
        }
      }
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const y = GROUND - o.h;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#06100b';
  if (o.kind === 'dice') {
    rr(ctx, o.x, y, o.w, o.h, 8);
    ctx.fillStyle = '#f4fff8';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0b1410';
    const pips: [number, number][] = [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.5, 0.5],
      [0.27, 0.73],
      [0.73, 0.73],
    ];
    for (const [px, py] of pips) {
      ctx.beginPath();
      ctx.arc(o.x + o.w * px, y + o.h * py, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (o.kind === 'chips') {
    for (let i = 0; i < 3; i++) {
      const cy = GROUND - 14 * (i + 1) - 2;
      rr(ctx, o.x, cy, o.w, 14, 6);
      ctx.fillStyle = i % 2 === 0 ? '#39e82a' : '#0b1410';
      ctx.fill();
      ctx.strokeStyle = i % 2 === 0 ? '#06100b' : '#39e82a';
      ctx.stroke();
      ctx.fillStyle = '#f4fff8';
      ctx.fillRect(o.x + 6, cy + 5, 6, 4);
      ctx.fillRect(o.x + o.w - 12, cy + 5, 6, 4);
    }
  } else {
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, y);
    ctx.lineTo(o.x + o.w / 2, GROUND);
    ctx.stroke();
    rr(ctx, o.x, y + 14, o.w, 46, 4);
    ctx.fillStyle = '#ff3b3b';
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#06100b';
    ctx.stroke();
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  g: Game,
  imgs: Imgs,
  best: number,
  sky: CanvasGradient,
  glow: CanvasGradient,
) {
  // sky + glow
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // skyline
  drawLayer(ctx, FAR, g.scroll * 0.15, '#0c2217', null);
  drawLayer(ctx, NEAR, g.scroll * 0.4, '#091a11', 'rgba(77,255,176,0.55)');

  // ground
  ctx.fillStyle = '#08130d';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#1d3a2b';
  const dashOff = g.scroll % 60;
  for (let x = -dashOff; x < W; x += 60) ctx.fillRect(x, GROUND + 24, 28, 4);
  ctx.strokeStyle = '#39e82a';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#39e82a';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 1.5);
  ctx.lineTo(W, GROUND + 1.5);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // obstacles
  g.obstacles.forEach((o) => drawObstacle(ctx, o));

  // pickups
  for (const p of g.pickups) {
    const bob = Math.sin(g.clock * 6 + p.x * 0.02) * 3;
    const isCoin = p.kind === 'coin';
    const size = isCoin ? 30 : 46;
    const im = isCoin ? imgs.coin : p.kind === 'steve' ? imgs.steve : imgs.lady;
    if (!isCoin) {
      ctx.shadowColor = '#39e82a';
      ctx.shadowBlur = 18;
    }
    if (ok(im)) {
      ctx.drawImage(im, p.x - size / 2, p.y - size / 2 + bob, size, size);
    } else {
      ctx.fillStyle = '#39e82a';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // player
  const bob =
    g.state === 'playing' && g.onGround
      ? -Math.abs(Math.sin(g.clock * 16)) * 5
      : g.state === 'ready'
        ? Math.sin(g.clock * 3) * 3
        : 0;
  const sx = 1 + g.squash * 0.18;
  const sy = 1 - g.squash * 0.18;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  const shadowScale = Math.max(0.4, 1 - (GROUND - g.py) / 220);
  ctx.ellipse(PLAYER_X + PLAYER_W / 2, GROUND + 4, 30 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(PLAYER_X + PLAYER_W / 2, g.py + bob);
  ctx.scale(sx, sy);
  ctx.translate(0, -PLAYER_H / 2);
  ctx.rotate(g.rot);
  if (ok(imgs.gamby)) {
    ctx.drawImage(imgs.gamby, -PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H);
  } else {
    ctx.fillStyle = '#39e82a';
    ctx.fillRect(-PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H);
  }
  ctx.restore();

  // popups
  ctx.textAlign = 'left';
  ctx.font = '800 18px system-ui, sans-serif';
  for (const p of g.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = '#4dffb0';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // hit flash
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${g.flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  // HUD
  ctx.fillStyle = '#e9fff3';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${scoreOf(g)}`, 18, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fb3a0';
  ctx.fillText(`BEST ${Math.max(best, scoreOf(g))}`, W - 18, 34);
  ctx.textAlign = 'left';
  if (ok(imgs.coin)) ctx.drawImage(imgs.coin, 18, 46, 22, 22);
  ctx.fillStyle = '#e9fff3';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillText(`x ${g.coins}`, 46, 64);

  // ready prompt
  if (g.state === 'ready') {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#39e82a';
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText('TAP OR PRESS SPACE TO RUN', W / 2, 150);
    ctx.fillStyle = '#c9e8d6';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('Jump the dice, chips and red candles', W / 2, 180);
  }
}

/* ---------- component ---------- */
export default function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<() => void>(() => {});
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const srcs: Record<ImgKey, string> = {
      gamby: '/images/gamby-stand.png',
      coin: '/images/gamdom-coin.png',
      steve: '/images/steve-face-circle.png',
      lady: '/images/lady-gamdom-circle.png',
    };
    const imgs = {} as Imgs;
    (Object.keys(srcs) as ImgKey[]).forEach((k) => {
      const im = new Image();
      im.src = srcs[k];
      imgs[k] = im;
    });

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04100a');
    sky.addColorStop(1, '#0f2c1d');
    const glow = ctx.createRadialGradient(620, 90, 10, 620, 90, 260);
    glow.addColorStop(0, 'rgba(57,232,42,0.28)');
    glow.addColorStop(1, 'rgba(57,232,42,0)');

    let best = 0;
    try {
      best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      best = 0;
    }

    const g = makeGame();

    const jump = () => {
      g.vy = -JUMP_V;
      g.onGround = false;
    };
    const begin = () => {
      Object.assign(g, makeGame());
      g.state = 'playing';
      jump();
    };
    const action = () => {
      if (g.state === 'ready') begin();
      else if (g.state === 'playing' && g.onGround) jump();
    };
    const finish = () => {
      const sc = scoreOf(g);
      const isBest = sc > best;
      if (isBest) {
        best = sc;
        try {
          localStorage.setItem(BEST_KEY, String(sc));
        } catch {
          /* storage unavailable */
        }
      }
      g.overAt = performance.now();
      setResult({ score: sc, best, coins: g.coins, isBest });
    };
    restartRef.current = () => {
      setResult(null);
      begin();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return;
      e.preventDefault();
      if (e.repeat) return;
      if (g.state === 'over') {
        if (performance.now() - g.overAt > 400) restartRef.current();
        return;
      }
      action();
    };
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      action();
    };

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(g, dt);
      draw(ctx, g, imgs, best, sky, glow);
      if (g.state === 'over' && !g.reported) {
        g.reported = true;
        finish();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  const share = () => {
    if (!result) return;
    const text = `I scored ${result.score} in Gamby Run on Gamdom Arcade! Can you beat it?`;
    const url = window.location.origin;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className={s.wrap}>
      <div className={s.top}>
        <Link href="/" className={s.back}>
          ← Menu
        </Link>
        <span className={s.title}>GAMBY RUN</span>
      </div>

      <div className={s.stage}>
        <canvas ref={canvasRef} className={s.canvas} />
        {result && (
          <div className={s.overlay}>
            <div className={s.card}>
              <span className={s.over}>GAME OVER</span>
              <span className={s.big}>{result.score}</span>
              {result.isBest && <span className={s.badge}>NEW BEST!</span>}
              <div className={s.stats}>
                <span>
                  Best <b>{result.best}</b>
                </span>
                <span>
                  Coins <b>{result.coins}</b>
                </span>
              </div>
              <div className={s.buttons}>
                <button className={s.btn} onClick={() => restartRef.current()}>
                  Play again
                </button>
                <button className={`${s.btn} ${s.ghost}`} onClick={share}>
                  Share on X
                </button>
                <Link href="/" className={`${s.btn} ${s.ghost}`}>
                  Menu
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className={s.hint}>Tap the screen or press Space to jump. Steve and Lady Gamdom are rare bonus pickups.</p>
    </div>
  );
}