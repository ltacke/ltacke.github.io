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

export function loadProfiles() {
  try { return JSON.parse(localStorage.getItem('wizard-profiles') ?? '[]'); }
  catch { return []; }
}

export function saveProfiles(profiles) {
  localStorage.setItem('wizard-profiles', JSON.stringify(profiles));
}

export function profileStats(profileName, games) {
  const lower = profileName.toLowerCase();
  const relevant = games.filter(g =>
    g.players.some(p => p.name.toLowerCase() === lower)
  );

  if (relevant.length === 0) return { gamesPlayed: 0, wins: 0, avgPoints: 0, accuracy: 0 };

  let wins = 0;
  let totalPoints = 0;
  let correctPredictions = 0;
  let totalRounds = 0;

  for (const game of relevant) {
    const player = game.players.find(p => p.name.toLowerCase() === lower);
    if (!player) continue;

    // Final score = last complete round's runningTotalAfterRound
    const playerScores = game.rounds
      .filter(r => r.phase === 'complete')
      .flatMap(r => r.scores)
      .filter(s => s.playerId === player.id);

    const finalScore = playerScores.at(-1)?.runningTotalAfterRound ?? 0;
    totalPoints += finalScore;

    // Win check: is this player's final score the max among all players?
    const allFinalScores = game.players.map(p => {
      const scores = game.rounds
        .filter(r => r.phase === 'complete')
        .flatMap(r => r.scores)
        .filter(s => s.playerId === p.id);
      return scores.at(-1)?.runningTotalAfterRound ?? 0;
    });
    if (finalScore === Math.max(...allFinalScores)) wins++;

    // Accuracy: count rounds where prediction === actual
    for (const round of game.rounds.filter(r => r.phase === 'complete')) {
      const prediction = round.predictions.find(p => p.playerId === player.id);
      const trickResult = round.trickResults.find(t => t.playerId === player.id);
      if (prediction && trickResult) {
        totalRounds++;
        if ((prediction.adjustedValue ?? 0) === trickResult.tricksWon) correctPredictions++;
      }
    }
  }

  return {
    gamesPlayed: relevant.length,
    wins,
    avgPoints: Math.round((totalPoints / relevant.length) * 10) / 10,
    accuracy: totalRounds > 0 ? Math.round((correctPredictions / totalRounds) * 1000) / 10 : 0,
  };
}
