// logic.test.js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  calculatePoints,
  roundCount,
  dealerSeatIndex,
  predictionOrder,
  forbiddenDealerPrediction,
  applyCloudAdjustment,
  effectiveBombCount,
  cumulativeScore,
  calculateRoundScores,
  createGame,
} from './logic.js';

test('calculatePoints: exact match', () => {
  assert.equal(calculatePoints(2, 2), 40); // 20 + 10*2
  assert.equal(calculatePoints(0, 0), 20); // 20 + 10*0
  assert.equal(calculatePoints(3, 3), 50); // 20 + 10*3
});

test('calculatePoints: miss', () => {
  assert.equal(calculatePoints(2, 1), -10);
  assert.equal(calculatePoints(0, 2), -20);
  assert.equal(calculatePoints(3, 0), -30);
});

test('roundCount', () => {
  assert.equal(roundCount(3), 20);
  assert.equal(roundCount(4), 15);
  assert.equal(roundCount(5), 12);
  assert.equal(roundCount(6), 10);
});

test('dealerSeatIndex', () => {
  assert.equal(dealerSeatIndex(1, 4), 0);
  assert.equal(dealerSeatIndex(2, 4), 1);
  assert.equal(dealerSeatIndex(5, 4), 0); // wraps
});

test('predictionOrder: dealer last', () => {
  // dealer at seat 0, 4 players → order: 1,2,3,0
  assert.deepEqual(predictionOrder(0, 4), [1, 2, 3, 0]);
  // dealer at seat 2, 4 players → order: 3,0,1,2
  assert.deepEqual(predictionOrder(2, 4), [3, 0, 1, 2]);
});

test('forbiddenDealerPrediction: normal mode round 3 (no restriction)', () => {
  assert.equal(forbiddenDealerPrediction([1, 1], 3, 'normal', 3), null);
});

test('forbiddenDealerPrediction: normal mode round 4 (restriction applies)', () => {
  // others sum to 2, available 3 → forbidden = 1
  assert.equal(forbiddenDealerPrediction([1, 1], 3, 'normal', 4), 1);
});

test('forbiddenDealerPrediction: forbidden out of range returns null', () => {
  // others sum to 5, available 3 → forbidden = -2 → null
  assert.equal(forbiddenDealerPrediction([3, 2], 3, 'normal', 4), null);
});

test('forbiddenDealerPrediction: hardcore mode round 1 (restriction applies)', () => {
  assert.equal(forbiddenDealerPrediction([0], 1, 'hardcore', 1), 1);
});

test('applyCloudAdjustment: increase', () => {
  assert.equal(applyCloudAdjustment(2, 'increase', 5), 3);
});

test('applyCloudAdjustment: decrease', () => {
  assert.equal(applyCloudAdjustment(2, 'decrease', 5), 1);
});

test('applyCloudAdjustment: out of bounds returns null', () => {
  assert.equal(applyCloudAdjustment(0, 'decrease', 5), null);
  assert.equal(applyCloudAdjustment(5, 'increase', 5), null);
});

test('effectiveBombCount', () => {
  const events = [
    { id: '1', cardType: 'bombe', playerId: null, adjustmentDirection: null },
    { id: '2', cardType: 'wolke', playerId: 'p1', adjustmentDirection: 'increase' },
  ];
  assert.equal(effectiveBombCount(events), 1);
  assert.equal(effectiveBombCount([]), 0);
});

test('cumulativeScore', () => {
  const rounds = [
    {
      roundNumber: 1, phase: 'complete',
      scores: [{ playerId: 'p1', pointsAwarded: 30, predictedTricks: 1, actualTricks: 1, runningTotalAfterRound: 30 }]
    },
    {
      roundNumber: 2, phase: 'complete',
      scores: [{ playerId: 'p1', pointsAwarded: -10, predictedTricks: 2, actualTricks: 1, runningTotalAfterRound: 20 }]
    },
    {
      roundNumber: 3, phase: 'prediction', // not complete — should be ignored
      scores: []
    }
  ];
  assert.equal(cumulativeScore('p1', 2, rounds), 20);
  assert.equal(cumulativeScore('p1', 1, rounds), 30);
});

test('calculateRoundScores', () => {
  const players = [
    { id: 'p1', name: 'Alice', seatIndex: 0 },
    { id: 'p2', name: 'Bob', seatIndex: 1 },
  ];
  const round = {
    roundNumber: 1,
    predictions: [
      { playerId: 'p1', adjustedValue: 1 },
      { playerId: 'p2', adjustedValue: 0 },
    ],
    trickResults: [
      { playerId: 'p1', tricksWon: 1 },
      { playerId: 'p2', tricksWon: 0 },
    ],
  };
  const scores = calculateRoundScores(round, players, []);
  const p1 = scores.find(s => s.playerId === 'p1');
  const p2 = scores.find(s => s.playerId === 'p2');
  assert.equal(p1.pointsAwarded, 30); // 20 + 10*1
  assert.equal(p2.pointsAwarded, 20); // 20 + 10*0
  assert.equal(p1.runningTotalAfterRound, 30);
  assert.equal(p2.runningTotalAfterRound, 20);
});

test('createGame: creates correct round count and dealer rotation', () => {
  const game = createGame(['Alice', 'Bob', 'Charlie', 'Diana'], 'normal', 15);
  assert.equal(game.players.length, 4);
  assert.equal(game.rounds.length, 15);
  assert.equal(game.rounds[0].cardsPerPlayer, 1);
  assert.equal(game.rounds[1].cardsPerPlayer, 2);
  assert.equal(game.rounds[0].dealerSeatIndex, 0);
  assert.equal(game.rounds[1].dealerSeatIndex, 1);
  assert.equal(game.rounds[4].dealerSeatIndex, 0); // wraps after 4 players
  assert.equal(game.currentRoundNumber, 1);
  assert.equal(game.isCompleted, false);
});
