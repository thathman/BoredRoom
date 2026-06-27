import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstalledGameSurface } from '@/components/session/InstalledGameSurface';

const feudState = {
  gameType: 'faith-feud', name: 'Faith Feud', emoji: '📣', mode: 'feud', phase: 'play',
  round: 1, totalRounds: 3,
  challenge: { kind: 'text', prompt: 'Name something you find in a Nigerian kitchen' },
  totalSlots: 5, maxStrikes: 3, strikes: 2,
  revealedAnswers: [{ index: 0, text: 'Maggi cube', points: 35 }],
  stealActive: false, activeTeam: 0,
  team1Ids: ['a1'], team2Ids: ['b1'],
  players: [{ id: 'a1', name: 'Ada', score: 35 }, { id: 'b1', name: 'Bola', score: 0 }],
  lastAction: '✅ Maggi cube — +35 pts!', submissions: {}, lastResults: [], winnerPlayerIds: [],
};

describe('Faith Feud answer board', () => {
  it('renders the prompt, a revealed answer, covered slots, strikes and team scores', () => {
    render(<InstalledGameSurface publicState={feudState} privateState={{ seated: true }} role="display" sendIntent={() => {}} />);
    expect(screen.getByText('📣 Faith Feud')).toBeInTheDocument();
    expect(screen.getByText('Name something you find in a Nigerian kitchen')).toBeInTheDocument();
    expect(screen.getByText('Maggi cube')).toBeInTheDocument(); // revealed
    expect(screen.getAllByText('35').length).toBeGreaterThanOrEqual(1); // points + team score
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    // covered slots show numbers 2..5
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('gives a seated controller an answer input', () => {
    render(<InstalledGameSurface publicState={feudState} privateState={{ seated: true, submitted: false, legalIntents: [{ type: 'answer_text', label: 'Answer' }] }} role="controller" sendIntent={() => {}} />);
    expect(screen.getByPlaceholderText('Your answer')).toBeInTheDocument();
  });

  it('renders the faceoff buzzer only for an eligible representative', () => {
    render(<InstalledGameSurface publicState={{ ...feudState, phase: 'faceoff_buzz' }} privateState={{ seated: true, legalIntents: [{ type: 'buzz', label: 'BUZZ!' }] }} role="controller" sendIntent={() => {}} />);
    expect(screen.getByRole('button', { name: 'BUZZ!' })).toBeInTheDocument();
  });

  it('renders survey collection input separately from gameplay answers', () => {
    render(<InstalledGameSurface publicState={{ ...feudState, phase: 'survey_collection', totalSlots: 0, collectionIndex: 0, collectionTotal: 2 }} privateState={{ seated: true, legalIntents: [{ type: 'survey_answer', label: 'Survey' }] }} role="controller" sendIntent={() => {}} />);
    expect(screen.getByPlaceholderText('Your answers, separated by commas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit survey' })).toBeInTheDocument();
  });
});
