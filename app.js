// app.js
import { createApp, reactive, computed, ref } from 'vue';
import {
  createGame, saveGames, loadGames, roundCount,
  predictionOrder, forbiddenDealerPrediction, calculateRoundScores,
  effectiveBombCount,
} from './logic.js';

// ─── Global State ────────────────────────────────────────────────────────────

const state = reactive({
  games: loadGames(),
  activeGameId: null,
  currentScreen: 'history',   // 'history' | 'setup' | 'prediction' | 'tricks' | 'grid' | 'results'
  viewMode: localStorage.getItem('wizard-view-mode') ?? 'focused', // 'focused' | 'grid'
  // Wolke-Picker: welcher Spieler wird gerade ausgewählt?
  cloudPickerOpen: false,
});

const activeGame = computed(() =>
  state.games.find(g => g.id === state.activeGameId) ?? null
);

const activeRound = computed(() => {
  const g = activeGame.value;
  if (!g) return null;
  return g.rounds.find(r => r.roundNumber === g.currentRoundNumber) ?? null;
});

function persist() {
  saveGames(state.games);
}

function updateGame(updatedGame) {
  const idx = state.games.findIndex(g => g.id === updatedGame.id);
  if (idx !== -1) state.games[idx] = updatedGame;
  else state.games.push(updatedGame);
  persist();
}

function setScreen(screen) {
  state.currentScreen = screen;
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('wizard-view-mode', mode);
}

// ─── HistoryScreen ────────────────────────────────────────────────────────────

const HistoryScreen = {
  setup() {
    const games = computed(() => [...state.games].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ));
    function openGame(game) {
      state.activeGameId = game.id;
      if (game.isCompleted) setScreen('results');
      else {
        const round = game.rounds.find(r => r.roundNumber === game.currentRoundNumber);
        setScreen(round?.phase === 'trickRecording' ? 'tricks' : 'prediction');
      }
    }
    function deleteGame(id) {
      if (!confirm('Spiel löschen?')) return;
      state.games = state.games.filter(g => g.id !== id);
      persist();
    }
    function formatDate(iso) {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    function scoreLabel(game) {
      if (!game.players.length) return '';
      const best = game.players.map(p => {
        const scores = game.rounds.flatMap(r => r.scores).filter(s => s.playerId === p.id);
        const total = scores.at(-1)?.runningTotalAfterRound ?? 0;
        return { name: p.name, total };
      }).sort((a, b) => b.total - a.total);
      return best.map(p => `${p.name}: ${p.total}`).join(' · ');
    }
    return { games, openGame, deleteGame, formatDate, scoreLabel };
  },
  template: `
    <div class="screen">
      <div v-if="games.length === 0" style="text-align:center;padding:40px 0;color:#57606a">
        <div style="font-size:48px;margin-bottom:16px">🧙</div>
        <p style="font-weight:600;margin-bottom:6px">Noch keine Spiele</p>
        <p style="font-size:13px">Starte ein neues Spiel unten.</p>
      </div>
      <div v-else>
        <p class="section-title">Gespeicherte Spiele</p>
        <div
          v-for="game in games" :key="game.id"
          class="history-item"
          @click="openGame(game)"
        >
          <div>
            <div style="font-weight:600;font-size:14px">
              {{ game.players.map(p => p.name).join(', ') }}
              <span v-if="game.isCompleted" style="font-size:11px;color:#16a34a;margin-left:6px">✓ Fertig</span>
              <span v-else style="font-size:11px;color:#3b82d4;margin-left:6px">Runde {{ game.currentRoundNumber }}/{{ game.selectedRounds }}</span>
            </div>
            <div class="history-meta">{{ formatDate(game.createdAt) }} · {{ game.mode === 'hardcore' ? 'Hardcore' : 'Normal' }}</div>
            <div class="history-meta">{{ scoreLabel(game) }}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:#57606a;font-size:18px">›</span>
            <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;width:auto"
              @click.stop="deleteGame(game.id)">✕</button>
          </div>
        </div>
      </div>
    </div>
    <div class="sticky-footer">
      <button class="btn btn-primary" @click="$emit('navigate', 'setup')">+ Neues Spiel</button>
    </div>
  `,
  emits: ['navigate'],
};

// ─── SetupScreen ──────────────────────────────────────────────────────────────

const SetupScreen = {
  setup(_, { emit }) {
    const playerCount = ref(4);
    const playerNames = ref(['', '', '', '']);
    const mode = ref('normal');
    const selectedRounds = ref(null); // null = max

    const maxRounds = computed(() => roundCount(playerCount.value));
    const effectiveRounds = computed(() => selectedRounds.value ?? maxRounds.value);

    function setPlayerCount(n) {
      playerCount.value = n;
      while (playerNames.value.length < n) playerNames.value.push('');
      playerNames.value = playerNames.value.slice(0, n);
      if ((selectedRounds.value ?? 999) > roundCount(n)) selectedRounds.value = null;
    }

    const canStart = computed(() => {
      const names = playerNames.value.slice(0, playerCount.value);
      const trimmed = names.map(n => n.trim());
      return trimmed.every(n => n.length > 0) && new Set(trimmed).size === trimmed.length;
    });

    function startGame() {
      if (!canStart.value) return;
      const names = playerNames.value.slice(0, playerCount.value).map(n => n.trim());
      const game = createGame(names, mode.value, effectiveRounds.value);
      updateGame(game);
      state.activeGameId = game.id;
      setScreen('prediction');
    }

    return { playerCount, playerNames, mode, selectedRounds, maxRounds, effectiveRounds, setPlayerCount, canStart, startGame };
  },
  template: `
    <div class="screen">
      <p class="section-title">Spieler</p>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button v-for="n in [3,4,5,6]" :key="n"
          class="btn" :class="playerCount === n ? 'btn-primary' : 'btn-secondary'"
          style="flex:1;padding:8px"
          @click="setPlayerCount(n)">{{ n }}</button>
      </div>
      <div v-for="(_, i) in playerNames.slice(0, playerCount)" :key="i" style="margin-bottom:8px">
        <input
          class="input-field"
          :placeholder="'Spieler ' + (i+1)"
          v-model="playerNames[i]"
          maxlength="20"
        />
      </div>

      <p class="section-title" style="margin-top:20px">Modus</p>
      <div class="mode-options">
        <div class="mode-option" :class="{selected: mode === 'normal'}" @click="mode = 'normal'">
          <h4>Normal</h4>
          <p>Sum-Rule ab Runde 4</p>
        </div>
        <div class="mode-option" :class="{selected: mode === 'hardcore'}" @click="mode = 'hardcore'">
          <h4>Hardcore</h4>
          <p>Sum-Rule ab Runde 1</p>
        </div>
      </div>

      <p class="section-title">Runden (max. {{ maxRounds }})</p>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" :min="1" :max="maxRounds" :value="effectiveRounds"
          @input="selectedRounds = Number($event.target.value)"
          style="flex:1">
        <span style="font-size:18px;font-weight:700;min-width:28px;text-align:center">{{ effectiveRounds }}</span>
      </div>
    </div>
    <div class="sticky-footer" style="display:flex;gap:10px">
      <button class="btn btn-secondary" style="flex:0 0 80px" @click="$emit('navigate', 'history')">← Zurück</button>
      <button class="btn btn-primary" style="flex:1" :disabled="!canStart" @click="startGame">Spiel starten</button>
    </div>
  `,
  emits: ['navigate'],
};

// ─── PredictionScreen ─────────────────────────────────────────────────────────

const PredictionScreen = {
  setup(_, { emit }) {
    const game = computed(() => activeGame.value);
    const round = computed(() => activeRound.value);

    const order = computed(() => {
      if (!round.value || !game.value) return [];
      return predictionOrder(round.value.dealerSeatIndex, game.value.playerCount);
    });

    // local draft predictions: seatIndex → value
    const draft = reactive({});
    function initDraft() {
      if (!game.value) return;
      game.value.players.forEach((_, i) => {
        draft[i] = round.value?.predictions.find(p =>
          p.playerId === game.value.players[i].id
        )?.originalValue ?? 0;
      });
    }
    initDraft();

    const dealer = computed(() => {
      if (!round.value || !game.value) return null;
      return game.value.players[round.value.dealerSeatIndex];
    });

    function playerAt(seatIndex) {
      return game.value?.players[seatIndex] ?? null;
    }

    function isDealer(seatIndex) {
      return seatIndex === round.value?.dealerSeatIndex;
    }

    const submittedCount = ref(0);

    const currentTurnSeat = computed(() => order.value[submittedCount.value] ?? null);

    function forbidden(seatIndex) {
      if (!isDealer(seatIndex) || !game.value || !round.value) return null;
      const others = order.value.slice(0, -1).map(si => draft[si]);
      return forbiddenDealerPrediction(
        others,
        round.value.availableTricksAfterBombs,
        game.value.mode,
        round.value.roundNumber
      );
    }

    function canSubmit() {
      if (!game.value || !round.value) return false;
      // all players have a value set
      const allSet = order.value.every(si => draft[si] !== undefined && draft[si] !== null);
      if (!allSet) return false;
      // dealer's value not forbidden
      const f = forbidden(round.value.dealerSeatIndex);
      return f === null || draft[round.value.dealerSeatIndex] !== f;
    }

    function setPrediction(seatIndex, value) {
      draft[seatIndex] = Math.max(0, Math.min(round.value?.cardsPerPlayer ?? 0, value));
    }

    function submitPredictions() {
      if (!canSubmit() || !game.value || !round.value) return;
      const predictions = game.value.players.map((p, i) => ({
        playerId: p.id,
        originalValue: draft[i],
        adjustedValue: draft[i],
        cloudAdjustment: null,
        isDealerPrediction: i === round.value.dealerSeatIndex,
      }));
      const updatedRound = {
        ...round.value,
        predictions,
        phase: 'trickRecording',
      };
      const updatedGame = {
        ...game.value,
        rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r),
      };
      updateGame(updatedGame);
      setScreen('tricks');
    }

    const predictionSum = computed(() => order.value.reduce((sum, si) => sum + (draft[si] ?? 0), 0));

    return {
      game, round, order, draft, dealer, playerAt, isDealer,
      currentTurnSeat, forbidden, canSubmit, setPrediction, submitPredictions,
      predictionSum,
    };
  },
  template: `
    <div v-if="round" class="screen">
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="info">{{ round.cardsPerPlayer }} Karten · Dealer:
            <span style="color:#7c5cd8;font-weight:600">{{ dealer?.name }}</span>
          </span>
          <span class="info">Σ {{ predictionSum }} / {{ round.availableTricksAfterBombs }}</span>
        </div>
      </div>

      <div v-for="seatIndex in order" :key="seatIndex">
        <div class="player-row">
          <div>
            <div class="player-name">
              {{ playerAt(seatIndex)?.name }}
              <span v-if="isDealer(seatIndex)" class="dealer-badge">Dealer</span>
            </div>
            <div v-if="forbidden(seatIndex) !== null" class="warning">
              Nicht erlaubt: {{ forbidden(seatIndex) }}
            </div>
          </div>
          <div class="stepper">
            <button @click="setPrediction(seatIndex, draft[seatIndex] - 1)"
              :disabled="draft[seatIndex] <= 0">−</button>
            <span class="value"
              :style="forbidden(seatIndex) !== null && draft[seatIndex] === forbidden(seatIndex) ? 'color:#dc2626' : ''">
              {{ draft[seatIndex] }}
            </span>
            <button @click="setPrediction(seatIndex, draft[seatIndex] + 1)"
              :disabled="draft[seatIndex] >= round.cardsPerPlayer">+</button>
          </div>
        </div>
      </div>
    </div>
    <div class="sticky-footer">
      <button class="btn btn-primary" :disabled="!canSubmit()" @click="submitPredictions">
        Ansagen bestätigen
      </button>
    </div>
  `,
  emits: ['navigate'],
};

// ─── App Root ────────────────────────────────────────────────────────────────

const App = {
  components: { HistoryScreen, SetupScreen, PredictionScreen },
  setup() {
    const inGame = computed(() => activeGame.value !== null && !['history', 'setup'].includes(state.currentScreen));
    const roundLabel = computed(() => {
      const g = activeGame.value;
      if (!g) return '';
      return `Runde ${g.currentRoundNumber}/${g.selectedRounds}`;
    });
    function navigate(screen) { setScreen(screen); }
    return { state, inGame, roundLabel, navigate, setViewMode };
  },
  template: `
    <div class="app-header">
      <div>
        <h1>🧙 Wizard</h1>
        <div v-if="inGame" class="subtitle">{{ roundLabel }}</div>
      </div>
      <div v-if="inGame" class="view-toggle">
        <button :class="{active: state.viewMode === 'focused'}" @click="setViewMode('focused')">📋</button>
        <button :class="{active: state.viewMode === 'grid'}" @click="setViewMode('grid')">📊</button>
      </div>
    </div>

    <HistoryScreen v-if="state.currentScreen === 'history'" @navigate="navigate" />
    <SetupScreen v-else-if="state.currentScreen === 'setup'" @navigate="navigate" />
    <PredictionScreen v-else-if="state.currentScreen === 'prediction'" @navigate="navigate" />
    <div v-else class="screen" style="display:flex;align-items:center;justify-content:center;color:#57606a">
      Weitere Screens folgen…
    </div>
  `,
};

createApp(App).mount('#app');
