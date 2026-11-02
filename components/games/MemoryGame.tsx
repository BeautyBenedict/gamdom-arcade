'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import s from './game.module.css';
import m from './memory.module.css';

const BEST_KEY = 'gamdom-arcade-memory-best';

interface Face {
  id: string;
  src: string;
  label: string;
  contain?: boolean;
}
interface CardT {
  uid: number;
  face: Face;
}
interface Result {
  score: number;
  best: number;
  isBest: boolean;
  moves: number;
  time: string;
}

const FACES: Face[] = [
  { id: 'steve', src: '/images/steve-face-card.png', label: 'Steve' },
  { id: 'lady', src: '/images/lady-gamdom-card.png', label: 'Lady Gamdom' },
  { id: 'chips', src: '/images/gamby-chips-card.png', label: 'Gamby with chips and coins' },
  { id: 'flag', src: '/images/gamby-flag-card.png', label: 'Gamby with his flag' },
  { id: 'gamby', src: '/images/gamby-stand.png', label: 'Gamby', contain: true },
  { id: 'coin', src: '/images/gamdom-coin.png', label: 'Gamdom coin', contain: true },
];

function buildDeck(): CardT[] {
  const cards = FACES.flatMap((f) => [f, f]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((face, uid) => ({ uid, face }));
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function MemoryGame() {
  const [deck, setDeck] = useState<CardT[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState(0);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = matched.length === FACES.length;

  // fresh deck on mount (client only, avoids hydration mismatch)
  useEffect(() => {
    setDeck(buildDeck());
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* storage unavailable */
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // clock
  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [started, done]);

  // win
  useEffect(() => {
    if (!done || result) return;
    const score = Math.max(100, 1200 - moves * 25 - seconds * 6);
    const isBest = score > best;
    if (isBest) {
      setBest(score);
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        /* storage unavailable */
      }
    }
    const t = setTimeout(
      () => setResult({ score, best: Math.max(best, score), isBest, moves, time: fmt(seconds) }),
      700,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const flip = (i: number) => {
    if (lock.current || done) return;
    const id = deck[i].face.id;
    if (flipped.includes(i) || matched.includes(id)) return;
    if (!started) setStarted(true);

    const next = [...flipped, i];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((x) => x + 1);
    if (deck[next[0]].face.id === id) {
      setMatched((x) => [...x, id]);
      setFlipped([]);
    } else {
      lock.current = true;
      timer.current = setTimeout(() => {
        setFlipped([]);
        lock.current = false;
      }, 850);
    }
  };

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    lock.current = false;
    setDeck(buildDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setResult(null);
  };

  const share = () => {
    if (!result) return;
    const text = `I cleared Gamdom Arcade Memory Match in ${result.moves} moves (${result.time}) and scored ${result.score}! Can you beat it?`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin)}`,
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
        <span className={s.title}>MEMORY MATCH</span>
      </div>

      <div className={m.hud}>
        <span>
          MOVES<b>{moves}</b>
        </span>
        <span>
          TIME<b>{fmt(seconds)}</b>
        </span>
        <span>
          PAIRS<b>{matched.length}/{FACES.length}</b>
        </span>
        <span>
          BEST<b>{best}</b>
        </span>
      </div>

      <div className={m.board}>
        <div className={m.grid}>
          {deck.map((c, i) => {
            const isMatched = matched.includes(c.face.id);
            const shown = flipped.includes(i) || isMatched;
            return (
              <button
                key={c.uid}
                className={`${m.cell} ${shown ? m.flipped : ''} ${isMatched ? m.matched : ''}`}
                onClick={() => flip(i)}
                disabled={isMatched}
                aria-label={shown ? c.face.label : 'Hidden card'}
              >
                <div className={m.inner}>
                  <div className={m.back}>
                    <img src="/images/gamdom-logo.jpg" alt="" draggable={false} />
                  </div>
                  <div className={`${m.face} ${c.face.contain ? m.contain : ''}`}>
                    <img src={c.face.src} alt={c.face.label} draggable={false} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {result && (
          <div className={s.overlay} style={{ borderRadius: 16 }}>
            <div className={s.card}>
              <span className={s.over}>ALL PAIRS FOUND</span>
              <span className={s.big}>{result.score}</span>
              {result.isBest && <span className={s.badge}>NEW BEST!</span>}
              <div className={s.stats}>
                <span>
                  Moves <b>{result.moves}</b>
                </span>
                <span>
                  Time <b>{result.time}</b>
                </span>
                <span>
                  Best <b>{result.best}</b>
                </span>
              </div>
              <div className={s.buttons}>
                <button className={s.btn} onClick={restart}>
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

      <p className={s.hint}>Flip two cards at a time. Fewer moves and a faster time give a higher score.</p>
    </div>
  );
}