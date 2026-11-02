import type { Metadata } from 'next';
import MemoryGame from '../../components/games/MemoryGame';

export const metadata: Metadata = {
  title: 'Memory Match | Gamdom Arcade',
};

export default function MemoryPage() {
  return (
    <main className="page">
      <MemoryGame />
    </main>
  );
}