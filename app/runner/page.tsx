import type { Metadata } from 'next';
import RunnerGame from '../../components/games/RunnerGame';

export const metadata: Metadata = {
  title: 'Gamby Run | Gamdom Arcade',
};

export default function RunnerPage() {
  return (
    <main className="page">
      <RunnerGame />
    </main>
  );
}