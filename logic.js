// logic.js
export function calculatePoints(predicted, actual) {
  if (predicted === actual) return 20 + 10 * actual;
  return -10 * Math.abs(predicted - actual);
}

export function roundCount(playerCount) {
  return ({ 3: 20, 4: 15, 5: 12, 6: 10 })[playerCount] ?? 0;
}

export function dealerSeatIndex(roundNumber, playerCount) {
  return (roundNumber - 1) % playerCount;
}

export function predictionOrder(dealerSeat, playerCount) {
  const order = [];
  for (let i = 1; i <= playerCount; i++) {
    order.push((dealerSeat + i) % playerCount);
  }
  return order;
}

export function forbiddenDealerPrediction(otherPredictions, available, mode, roundNumber) {
  const start = mode === 'hardcore' ? 1 : 4;
  if (roundNumber < start) return null;
  const sum = otherPredictions.reduce((a, b) => a + b, 0);
  const forbidden = available - sum;
  if (forbidden < 0 || forbidden > available) return null;
  return forbidden;
}

export function applyCloudAdjustment(originalValue, direction, cardsPerPlayer) {
  const proposed = originalValue + (direction === 'increase' ? 1 : -1);
  if (proposed < 0 || proposed > cardsPerPlayer) return null;
  return proposed;
}

export function effectiveBombCount(specialCardEvents) {
  return specialCardEvents.filter(e => e.cardType === 'bombe').length;
}

export function cumulativeScore(playerId, throughRound, rounds) {
  return rounds
    .filter(r => r.roundNumber <= throughRound && r.phase === 'complete')
    .flatMap(r => r.scores)
    .filter(s => s.playerId === playerId)
    .reduce((sum, s) => sum + s.pointsAwarded, 0);
}

export function calculateRoundScores(round, players, previousRounds) {
  return players.map(player => {
    const prediction = round.predictions.find(p => p.playerId === player.id);
    const trickResult = round.trickResults.find(t => t.playerId === player.id);
    const predicted = prediction?.adjustedValue ?? 0;
    const actual = trickResult?.tricksWon ?? 0;
    const pointsAwarded = calculatePoints(predicted, actual);
    const previousTotal = cumulativeScore(player.id, round.roundNumber - 1, previousRounds);
    return {
      playerId: player.id,
      predictedTricks: predicted,
      actualTricks: actual,
      pointsAwarded,
      runningTotalAfterRound: previousTotal + pointsAwarded,
    };
  });
}

export function createGame(playerNames, mode, selectedRounds) {
  const players = playerNames.map((name, i) => ({
    id: crypto.randomUUID(),
    name: name.trim(),
    seatIndex: i,
  }));
  const rounds = Array.from({ length: selectedRounds }, (_, i) => {
    const rn = i + 1;
    return {
      roundNumber: rn,
      cardsPerPlayer: rn,
      dealerSeatIndex: dealerSeatIndex(rn, players.length),
      phase: 'prediction',
      predictions: [],
      trickResults: [],
      specialCardEvents: [],
      scores: [],
      availableTricksAfterBombs: rn,
    };
  });
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    playerCount: players.length,
    mode,
    selectedRounds,
    players,
    rounds,
    currentRoundNumber: 1,
    isCompleted: false,
  };
}

export function saveGames(games) {
  try {
    localStorage.setItem('wizard-games-v1', JSON.stringify(games));
  } catch (_) {}
}

export function loadGames() {
  try {
    return JSON.parse(localStorage.getItem('wizard-games-v1') ?? '[]');
  } catch (_) {
    return [];
  }
}
