import Link from 'next/link';

const games = [
  {
    href: '/runner',
    emoji: '🏃',
    title: 'Gamby Run',
    text: 'Jump over dice, chips and red candles. Grab coins. One hit and it is game over.',
  },
  {
    href: '/memory',
    emoji: '🃏',
    title: 'Memory Match',
    text: 'Flip the cards and find every pair before the clock runs out.',
  },
];

export default function Home() {
  return (
    <main className="page">
      <div className="brand">
        <img src="/images/gamdom-logo.jpg" alt="Gamdom logo" />
        <span>GAMDOM ARCADE</span>
      </div>

      <section className="hero">
        <img src="/images/gamby-stand.png" alt="Gamby" />
        <h1>
          Play with <em>Gamby</em>
        </h1>
        <p>Quick fun games. Beat your best score and share it.</p>
      </section>

      <section className="cards">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="card">
            <span className="emoji">{g.emoji}</span>
            <h2>{g.title}</h2>
            <p>{g.text}</p>
            <span className="play">Play</span>
          </Link>
        ))}
      </section>

      <p className="footnote">Just for fun. Points only, no real money.</p>
    </main>
  );
}