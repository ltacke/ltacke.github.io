// app.js
import { createApp, reactive, computed, ref } from 'vue';
import {
  createGame, saveGames, loadGames, roundCount,
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

// ─── App Root ────────────────────────────────────────────────────────────────

const App = {
  components: { HistoryScreen, SetupScreen },
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
    <div v-else class="screen" style="display:flex;align-items:center;justify-content:center;color:#57606a">
      Weitere Screens folgen…
    </div>
  `,
};

createApp(App).mount('#app');
