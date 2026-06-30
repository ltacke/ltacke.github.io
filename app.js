const sonderkartenData = [
  {
    name: 'Gestaltenwandler',
    image: 'Gestaltenwandler.png',
    rules: [
      'Beim Ausspielen entscheidest du: Narr oder Zauberer.',
      'Wird danach exakt wie die gewählte Karte behandelt.',
    ],
    notes: [
      'Trumpfbestimmung: Geber bestimmt die Trumpffarbe.',
    ],
  },
  {
    name: 'Drache',
    image: 'Drache.png',
    rules: [
      'Höchste Karte im Spiel — schlägt alles, außer die Fee.',
      'Gewinnt jeden Stich, in dem er liegt (außer gegen Fee).',
    ],
    notes: [
      'Trumpfbestimmung: Geber bestimmt Trumpf.',
      'Als erste Karte gespielt: verhält sich wie ein Zauberer.',
    ],
  },
  {
    name: 'Fee',
    image: 'Fee.png',
    rules: [
      'Niedrigste Karte im Spiel — verliert jeden Stich.',
      'Ausnahme: schlägt den Drachen, wenn beide im Stich liegen.',
    ],
    notes: [
      'Trumpfbestimmung: kein Trumpf.',
      'Als erste Karte gespielt: verhält sich wie ein Narr.',
    ],
  },
  {
    name: 'Bombe',
    image: 'Bombe.png',
    rules: [
      'Der Stich zählt nicht und gehört niemandem.',
      'Kein Einfluss auf Stichvorhersagen.',
      'Der Spieler, der ohne Bombe gewonnen hätte, eröffnet den nächsten Stich.',
    ],
    notes: [
      'Trumpfbestimmung: kein Trumpf.',
      'Als erste Karte gespielt: wie ein Narr.',
    ],
  },
  {
    name: 'Werwolf',
    image: 'Werwolf.png',
    rules: [
      'Zu Beginn der Runde: tausche ihn gegen die aufgedeckte Trumpfkarte.',
      'Bestimme danach selbst eine Trumpffarbe oder „kein Trumpf".',
      'Erst danach beginnen die Vorhersagen.',
    ],
    notes: [
      'Trumpfbestimmung: Geber bestimmt Trumpf.',
    ],
  },
  {
    name: 'Jongleur',
    image: 'Jongleur.png',
    rules: [
      'Wert: 7,5 (zwischen 7 und 8).',
      'Beim Spielen bestimmst du seine Farbe (auch Trumpf möglich).',
      'Nach dem Stich: alle geben gleichzeitig 1 Karte nach links weiter.',
      'Die Weitergabe entfällt nur im letzten Stich — nicht bei Bombe.',
    ],
    notes: [
      'Trumpfbestimmung: Geber bestimmt Trumpf.',
      'Als erste Karte: angesagte Farbe muss bedient werden.',
    ],
  },
  {
    name: 'Wolke',
    image: 'Wolke.png',
    rules: [
      'Wert: 9,75 (zwischen 9 und 10).',
      'Beim Spielen bestimmst du die Farbe.',
      'Am Ende der Runde: Besitzer muss Vorhersage um +1 oder −1 ändern.',
      'Ausnahme: zusammen mit Bombe → keine Änderung.',
    ],
    notes: [
      'Trumpfbestimmung: Geber bestimmt Trumpf.',
      'Als erste Karte: angesagte Farbe muss bedient werden.',
    ],
  },
  {
    name: 'Vampir',
    image: 'Vampir.png',
    rules: [
      'Kopiert die Karte, die zur Trumpfbestimmung aufgedeckt wurde — inkl. all ihrer Effekte.',
      'Liegt ein Werwolf als Trumpfkarte, wird sofort eine neue Karte aufgedeckt (diese wird kopiert).',
    ],
    notes: [
      'Bedienen: Muss nicht als Trumpf bedient werden.',
      'Eröffnest du den Stich: Bedienregeln der kopierten Karte gelten.',
    ],
  },
  {
    name: 'Hexe',
    image: 'Hexe.png',
    rules: [
      'Niedrigerer Wert als Narr und Fee — verliert immer den Stich.',
      'Nach Stichauswertung: lege eine Handkarte in den Stich, nimm eine beliebige Karte daraus auf die Hand.',
      'Die in den Stich gelegte Karte hat keinen Effekt.',
    ],
    notes: [
      'Trumpfbestimmung: kein Trumpf.',
      'Eröffnest du den Stich: wie ein Narr (keine Farbe muss bedient werden).',
    ],
  },
];


// app.js
import { createApp, reactive, computed, ref, watch } from 'vue';
import {
  createGame, saveGames, loadGames, roundCount,
  predictionOrder, forbiddenDealerPrediction, calculateRoundScores,
  effectiveBombCount, applyCloudAdjustment,
  loadProfiles, saveProfiles, profileStats,
} from './logic.js';

// ─── Global State ────────────────────────────────────────────────────────────

const state = reactive({
  games: loadGames(),
  profiles: loadProfiles(),
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

function persistProfiles() {
  saveProfiles(state.profiles);
}

function resizePhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Crop to square from center
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
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

// ─── ProfileFormOverlay ───────────────────────────────────────────────────────

const ProfileFormOverlay = {
  props: ['show', 'editProfile'],
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const name = ref('');
    const photo = ref(null);
    const fileInput = ref(null);

    watch(() => props.show, (v) => {
      if (v) {
        name.value = props.editProfile?.name ?? '';
        photo.value = props.editProfile?.photo ?? null;
      }
    });

    async function onFileChange(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const result = await resizePhoto(file);
      if (result) photo.value = result;
      e.target.value = '';
    }

    function save() {
      if (!name.value.trim()) return;
      const profile = {
        id: props.editProfile?.id ?? crypto.randomUUID(),
        name: name.value.trim(),
        photo: photo.value,
        createdAt: props.editProfile?.createdAt ?? new Date().toISOString(),
      };
      const idx = state.profiles.findIndex(p => p.id === profile.id);
      if (idx !== -1) state.profiles[idx] = profile;
      else state.profiles.push(profile);
      persistProfiles();
      emit('saved', profile);
      emit('close');
    }

    return { name, photo, fileInput, onFileChange, save };
  },
  template: `
    <div v-if="show" class="overlay-scrim" @click.self="$emit('close')">
      <div class="overlay-panel">
        <div class="overlay-header">
          <h2>{{ editProfile ? 'Profil bearbeiten' : 'Neues Profil' }}</h2>
          <button class="overlay-close" @click="$emit('close')">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0 16px">
          <img v-if="photo" :src="photo" class="avatar" style="width:80px;height:80px" />
          <div v-else class="avatar-placeholder" style="width:80px;height:80px">👤</div>
          <button class="btn btn-secondary" style="width:auto;padding:8px 20px"
            @click="fileInput.click()">📷 Foto wählen</button>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileChange" />
        </div>
        <div style="margin-bottom:16px">
          <input class="input-field" placeholder="Name" v-model="name" maxlength="20" />
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" style="flex:1" @click="$emit('close')">Abbrechen</button>
          <button class="btn btn-primary" style="flex:1" :disabled="!name.trim()" @click="save">Speichern</button>
        </div>
      </div>
    </div>
  `,
};


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

// ─── TricksScreen ─────────────────────────────────────────────────────────────

const TricksScreen = {
  setup() {
    const game = computed(() => activeGame.value);
    const round = computed(() => activeRound.value);

    const trickDraft = reactive({});
    function initDraft() {
      if (!game.value || !round.value) return;
      game.value.players.forEach(p => {
        const existing = round.value.trickResults.find(t => t.playerId === p.id);
        trickDraft[p.id] = existing?.tricksWon ?? 0;
      });
    }
    initDraft();

    const specialOpen = ref(false);

    const bombCount = computed(() => round.value ? effectiveBombCount(round.value.specialCardEvents) : 0);
    const cloudCount = computed(() => round.value ? round.value.specialCardEvents.filter(e => e.cardType === 'wolke').length : 0);
    const available = computed(() => round.value ? round.value.availableTricksAfterBombs : 0);
    const trickSum = computed(() => Object.values(trickDraft).reduce((a, b) => a + b, 0));
    const isValid = computed(() => trickSum.value === available.value);

    function setTricks(playerId, value) {
      trickDraft[playerId] = Math.max(0, Math.min(round.value?.cardsPerPlayer ?? 0, value));
    }

    function predictionFor(playerId) {
      return round.value?.predictions.find(p => p.playerId === playerId);
    }

    function cumulativeFor(playerId) {
      if (!game.value) return 0;
      const prevRounds = game.value.rounds.filter(r => r.roundNumber < (round.value?.roundNumber ?? 1) && r.phase === 'complete');
      return prevRounds.flatMap(r => r.scores).filter(s => s.playerId === playerId).at(-1)?.runningTotalAfterRound ?? 0;
    }

    function addBomb() {
      if (!game.value || !round.value) return;
      const newEvent = { id: crypto.randomUUID(), cardType: 'bombe', playerId: null, adjustmentDirection: null };
      const updatedEvents = [...round.value.specialCardEvents, newEvent];
      const bombs = effectiveBombCount(updatedEvents);
      if (round.value.cardsPerPlayer - bombs < 0) return;
      const updatedRound = {
        ...round.value,
        specialCardEvents: updatedEvents,
        availableTricksAfterBombs: round.value.cardsPerPlayer - bombs,
      };
      updateGame({ ...game.value, rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r) });
    }

    function removeBomb() {
      if (!game.value || !round.value) return;
      const events = [...round.value.specialCardEvents];
      const lastBombIdx = events.map(e => e.cardType).lastIndexOf('bombe');
      if (lastBombIdx === -1) return;
      events.splice(lastBombIdx, 1);
      const updatedRound = {
        ...round.value,
        specialCardEvents: events,
        availableTricksAfterBombs: round.value.cardsPerPlayer - effectiveBombCount(events),
      };
      updateGame({ ...game.value, rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r) });
    }

    const cloudPickerId = ref(null); // playerId der ausgewählt wird

    function openCloudPicker() { cloudPickerId.value = 'picking'; }

    function applyCloud(playerId, direction) {
      if (!game.value || !round.value) return;
      const prediction = round.value.predictions.find(p => p.playerId === playerId);
      if (!prediction) return;
      const newValue = applyCloudAdjustment(prediction.originalValue, direction, round.value.cardsPerPlayer);
      if (newValue === null) { cloudPickerId.value = null; return; }
      const newEvent = { id: crypto.randomUUID(), cardType: 'wolke', playerId, adjustmentDirection: direction };
      const updatedPredictions = round.value.predictions.map(p =>
        p.playerId === playerId
          ? { ...p, adjustedValue: newValue, cloudAdjustment: { direction } }
          : p
      );
      const updatedRound = {
        ...round.value,
        predictions: updatedPredictions,
        specialCardEvents: [...round.value.specialCardEvents, newEvent],
      };
      updateGame({ ...game.value, rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r) });
      cloudPickerId.value = null;
    }

    function removeCloud() {
      if (!game.value || !round.value) return;
      const events = [...round.value.specialCardEvents];
      const lastCloudIdx = events.map(e => e.cardType).lastIndexOf('wolke');
      if (lastCloudIdx === -1) return;
      const removed = events.splice(lastCloudIdx, 1)[0];
      const updatedPredictions = round.value.predictions.map(p =>
        p.playerId === removed.playerId
          ? { ...p, adjustedValue: p.originalValue, cloudAdjustment: null }
          : p
      );
      const updatedRound = { ...round.value, predictions: updatedPredictions, specialCardEvents: events };
      updateGame({ ...game.value, rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r) });
    }

    function submitTricks() {
      if (!isValid.value || !game.value || !round.value) return;
      const trickResults = game.value.players.map(p => ({ playerId: p.id, tricksWon: trickDraft[p.id] }));
      const tempRound = { ...round.value, trickResults };
      const prevRounds = game.value.rounds.filter(r => r.roundNumber < round.value.roundNumber);
      const scores = calculateRoundScores(tempRound, game.value.players, prevRounds);
      const completedRound = { ...tempRound, trickResults, scores, phase: 'complete' };

      const isLast = round.value.roundNumber >= game.value.selectedRounds;
      const newCurrentRound = isLast ? game.value.currentRoundNumber : round.value.roundNumber + 1;

      const updatedGame = {
        ...game.value,
        rounds: game.value.rounds.map(r => r.roundNumber === completedRound.roundNumber ? completedRound : r),
        currentRoundNumber: newCurrentRound,
        isCompleted: isLast,
      };
      updateGame(updatedGame);
      setScreen(isLast ? 'results' : 'prediction');
    }

    function goBackToPrediction() {
      if (!game.value || !round.value) return;
      const updatedRound = { ...round.value, phase: 'prediction', trickResults: [], specialCardEvents: [], scores: [], availableTricksAfterBombs: round.value.cardsPerPlayer };
      updateGame({ ...game.value, rounds: game.value.rounds.map(r => r.roundNumber === updatedRound.roundNumber ? updatedRound : r) });
      setScreen('prediction');
    }

    return {
      game, round, trickDraft, specialOpen, bombCount, cloudCount, available,
      trickSum, isValid, setTricks, predictionFor, cumulativeFor,
      addBomb, removeBomb, cloudPickerId, openCloudPicker, applyCloud, removeCloud,
      submitTricks, goBackToPrediction,
    };
  },
  template: `
    <div v-if="round" class="screen">
      <!-- Summary -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between">
          <span class="info">{{ round.cardsPerPlayer }} Karten</span>
          <span class="info" :style="trickSum === available ? 'color:#16a34a;font-weight:600' : trickSum > available ? 'color:#dc2626' : ''">
            Stiche: {{ trickSum }} / {{ available }}
          </span>
        </div>
        <div v-if="bombCount > 0" class="info" style="margin-top:4px">
          💣 {{ bombCount }} Bombe{{ bombCount > 1 ? 'n' : '' }} → {{ available }} verfügbar
        </div>
      </div>

      <!-- Special Cards -->
      <div style="margin-bottom:16px">
        <button class="special-toggle" @click="specialOpen = !specialOpen">
          <span>✨ Sonderkarten
            <span v-if="bombCount > 0" style="color:#f97316"> 💣{{bombCount}}</span>
            <span v-if="cloudCount > 0" style="color:#3b82d4"> ☁️{{cloudCount}}</span>
          </span>
          <span>{{ specialOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-if="specialOpen" class="special-body">
          <div style="flex:1">
            <div style="display:flex;gap:6px;align-items:center">
              <button class="special-btn bomb" @click="addBomb" :disabled="available <= 0">💣 Bombe</button>
              <button v-if="bombCount > 0" @click="removeBomb"
                style="padding:6px;background:#fee2e2;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#dc2626">✕</button>
            </div>
          </div>
          <div style="flex:1">
            <div style="display:flex;gap:6px;align-items:center">
              <button class="special-btn cloud" @click="openCloudPicker">☁️ Wolke</button>
              <button v-if="cloudCount > 0" @click="removeCloud"
                style="padding:6px;background:#fee2e2;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#dc2626">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud Picker -->
      <div v-if="cloudPickerId === 'picking'" class="card" style="margin-bottom:16px">
        <p style="font-weight:600;margin-bottom:10px">☁️ Wolke: Welcher Spieler, welche Richtung?</p>
        <div v-for="p in game.players" :key="p.id" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>{{ p.name }}</span>
            <div style="display:flex;gap:6px">
              <button class="special-btn cloud" style="padding:6px 12px" @click="applyCloud(p.id, 'increase')">+1</button>
              <button class="special-btn cloud" style="padding:6px 12px" @click="applyCloud(p.id, 'decrease')">−1</button>
            </div>
          </div>
        </div>
        <button class="btn btn-secondary" style="margin-top:8px" @click="cloudPickerId = null">Abbrechen</button>
      </div>

      <!-- Trick inputs -->
      <div v-for="player in game.players" :key="player.id">
        <div class="player-row">
          <div>
            <div class="player-name">{{ player.name }}</div>
            <div class="player-meta">
              Ansage: {{ predictionFor(player.id)?.adjustedValue ?? '?' }}
              <span v-if="predictionFor(player.id)?.cloudAdjustment" style="color:#3b82d4"> (☁️{{ predictionFor(player.id).originalValue }}→{{ predictionFor(player.id).adjustedValue }})</span>
              · Gesamt: {{ cumulativeFor(player.id) }}
            </div>
          </div>
          <div class="stepper">
            <button @click="setTricks(player.id, trickDraft[player.id] - 1)"
              :disabled="trickDraft[player.id] <= 0">−</button>
            <span class="value">{{ trickDraft[player.id] }}</span>
            <button @click="setTricks(player.id, trickDraft[player.id] + 1)"
              :disabled="trickDraft[player.id] >= round.cardsPerPlayer">+</button>
          </div>
        </div>
      </div>

      <div v-if="!isValid" class="warning" style="text-align:center;margin-top:12px">
        Stiche müssen {{ available }} ergeben (aktuell {{ trickSum }})
      </div>
    </div>
    <div class="sticky-footer" style="display:flex;gap:10px">
      <button class="btn btn-secondary" style="flex:0 0 100px" @click="goBackToPrediction">← Ansagen</button>
      <button class="btn btn-primary" style="flex:1" :disabled="!isValid" @click="submitTricks">Runde abschließen</button>
    </div>
  `,
};

// ─── GridScreen ───────────────────────────────────────────────────────────────

const GridScreen = {
  setup() {
    const game = computed(() => activeGame.value);
    const round = computed(() => activeRound.value);

    function scoreFor(playerId, roundNumber) {
      const r = game.value?.rounds.find(r => r.roundNumber === roundNumber);
      return r?.scores.find(s => s.playerId === playerId) ?? null;
    }

    function scoreClass(points) {
      if (points === undefined || points === null) return '';
      if (points > 0) return 'score-pos';
      if (points < 0) return 'score-neg';
      return 'score-zero';
    }

    function currentTotal(playerId) {
      const scores = game.value?.rounds.flatMap(r => r.scores).filter(s => s.playerId === playerId) ?? [];
      return scores.at(-1)?.runningTotalAfterRound ?? 0;
    }

    return { game, round, scoreFor, scoreClass, currentTotal };
  },
  template: `
    <div v-if="game" class="screen" style="padding:0;overflow-x:auto">
      <table class="score-grid">
        <thead>
          <tr>
            <th>Rd</th>
            <th v-for="p in game.players" :key="p.id">
              {{ p.name }}<br>
              <span style="font-weight:400;font-size:11px" :class="scoreClass(currentTotal(p.id))">{{ currentTotal(p.id) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rn in game.selectedRounds" :key="rn"
            :class="rn === game.currentRoundNumber ? 'current-round' : ''">
            <td>
              {{ rn }}
              <span v-if="game.rounds.find(r => r.roundNumber === rn)?.specialCardEvents.some(e => e.cardType === 'bombe')"> 💣</span>
            </td>
            <td v-for="p in game.players" :key="p.id">
              <template v-if="scoreFor(p.id, rn)">
                <span :class="scoreClass(scoreFor(p.id, rn).pointsAwarded)">
                  {{ scoreFor(p.id, rn).pointsAwarded > 0 ? '+' : '' }}{{ scoreFor(p.id, rn).pointsAwarded }}
                </span>
                <br>
                <span style="font-size:11px;color:#57606a">{{ scoreFor(p.id, rn).runningTotalAfterRound }}</span>
              </template>
              <template v-else-if="rn === game.currentRoundNumber">
                <span style="color:#3b82d4">…</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
};

// ─── ResultsScreen ────────────────────────────────────────────────────────────

const ResultsScreen = {
  setup() {
    const game = computed(() => activeGame.value);
    const standings = computed(() => {
      if (!game.value) return [];
      return game.value.players.map(p => {
        const scores = game.value.rounds.flatMap(r => r.scores).filter(s => s.playerId === p.id);
        return { name: p.name, total: scores.at(-1)?.runningTotalAfterRound ?? 0 };
      }).sort((a, b) => b.total - a.total);
    });
    const winner = computed(() => standings.value[0]);
    return { game, standings, winner };
  },
  template: `
    <div v-if="game" class="screen">
      <div style="text-align:center;padding:20px 0 24px">
        <div style="font-size:48px;margin-bottom:8px">🏆</div>
        <h2 style="font-size:20px;font-weight:700">{{ winner?.name }} gewinnt!</h2>
        <p class="info">{{ winner?.total }} Punkte</p>
      </div>

      <div class="podium">
        <div v-for="(p, i) in standings" :key="p.name"
          class="podium-item" :class="i === 0 ? 'first' : ''">
          <div class="rank-badge" :class="i === 0 ? 'gold' : ''">{{ i + 1 }}</div>
          <div style="flex:1">
            <div style="font-weight:600">{{ p.name }}</div>
          </div>
          <div :class="p.total >= 0 ? 'score-pos' : 'score-neg'" style="font-size:18px;font-weight:700">
            {{ p.total }}
          </div>
        </div>
      </div>
    </div>
    <div class="sticky-footer" style="display:flex;gap:10px">
      <button class="btn btn-secondary" style="flex:1" @click="$emit('navigate', 'grid')">📊 Vollständiges Grid</button>
      <button class="btn btn-primary" style="flex:1" @click="$emit('navigate', 'history')">Neue Runde</button>
    </div>
  `,
  emits: ['navigate'],
};

// ─── App Root ────────────────────────────────────────────────────────────────

const InfoOverlay = {
  props: ['show'],
  emits: ['close'],
  setup() {
    const selected = ref(null);
    function select(card) {
      selected.value = selected.value?.name === card.name ? null : card;
    }
    return { cards: sonderkartenData, selected, select };
  },
  template: `
    <div v-if="show" class="overlay-scrim" @click.self="$emit('close')">
      <div class="overlay-panel">
        <div class="overlay-header">
          <h2>Sonderkarten</h2>
          <button class="overlay-close" @click="$emit('close')">✕</button>
        </div>
        <div class="card-grid">
          <button
            v-for="card in cards"
            :key="card.name"
            class="card-tile"
            :class="{ active: selected?.name === card.name }"
            @click="select(card)"
          >
            <img :src="'./Sonderkarten-Bilder copy/' + card.image" :alt="card.name" />
            <span>{{ card.name }}</span>
          </button>
        </div>
        <div v-if="selected" class="card-detail">
          <h3>{{ selected.name }}</h3>
          <ul>
            <li v-for="rule in selected.rules" :key="rule">{{ rule }}</li>
          </ul>
          <ul v-if="selected.notes.length" class="detail-notes">
            <li v-for="note in selected.notes" :key="note">{{ note }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
};

const App = {
  components: { HistoryScreen, SetupScreen, PredictionScreen, TricksScreen, GridScreen, ResultsScreen, InfoOverlay },
  setup() {
    const inGame = computed(() => activeGame.value !== null && !['history', 'setup'].includes(state.currentScreen));
    const showInfo = ref(false);
    const roundLabel = computed(() => {
      const g = activeGame.value;
      if (!g) return '';
      return `Runde ${g.currentRoundNumber}/${g.selectedRounds}`;
    });
    function navigate(screen) {
      setScreen(screen);
      if (screen === 'grid') setViewMode('grid');
      if (screen === 'prediction' || screen === 'tricks') setViewMode('focused');
    }
    return { state, activeGame, inGame, roundLabel, navigate, setViewMode, showInfo };
  },
  template: `
    <div class="app-header">
      <div>
        <h1>🧙 Wizard</h1>
        <div v-if="inGame" class="subtitle">{{ roundLabel }}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button v-if="inGame" class="info-btn" @click="showInfo = true">ℹ️</button>
        <div v-if="inGame" class="view-toggle">
          <button :class="{active: state.viewMode === 'focused'}"
            @click="navigate(activeGame?.rounds.find(r=>r.roundNumber===activeGame.currentRoundNumber)?.phase === 'trickRecording' ? 'tricks' : 'prediction')">📋</button>
          <button :class="{active: state.viewMode === 'grid'}" @click="navigate('grid')">📊</button>
        </div>
      </div>
    </div>

    <HistoryScreen v-if="state.currentScreen === 'history'" @navigate="navigate" />
    <SetupScreen v-else-if="state.currentScreen === 'setup'" @navigate="navigate" />
    <PredictionScreen v-else-if="state.currentScreen === 'prediction'" @navigate="navigate" />
    <TricksScreen v-else-if="state.currentScreen === 'tricks'" @navigate="navigate" />
    <GridScreen v-else-if="state.currentScreen === 'grid'" />
    <ResultsScreen v-else-if="state.currentScreen === 'results'" @navigate="navigate" />

    <InfoOverlay :show="showInfo" @close="showInfo = false" />
  `,
};

createApp(App).mount('#app');
