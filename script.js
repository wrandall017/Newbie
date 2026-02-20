const defaultGroups = [
  {
    name: 'Upper Body',
    rounds: 3,
    stations: [
      { name: 'Push-ups', seconds: 45, restSeconds: 20 },
      { name: 'Rows', seconds: 45, restSeconds: 20 },
      { name: 'Plank Hold', seconds: 35, restSeconds: 30 },
    ],
  },
  {
    name: 'Conditioning',
    rounds: 2,
    stations: [
      { name: 'Jumping Jacks', seconds: 40, restSeconds: 15 },
      { name: 'Squat Pulses', seconds: 45, restSeconds: 20 },
    ],
  },
];

const state = {
  groups: structuredClone(defaultGroups),
  timeline: [],
  currentIndex: 0,
  running: false,
  remainingMs: 0,
  timerId: null,
  previousTick: null,
};

const phaseLabelEl = document.getElementById('phase-label');
const stepNameEl = document.getElementById('step-name');
const groupMetaEl = document.getElementById('group-meta');
const timeLeftEl = document.getElementById('time-left');
const stepCountEl = document.getElementById('step-count');
const progressBarEl = document.getElementById('progress-bar');
const startBtn = document.getElementById('start-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const resetBtn = document.getElementById('reset-btn');
const addGroupBtn = document.getElementById('add-group-btn');
const groupListEl = document.getElementById('group-list');
const groupTemplate = document.getElementById('group-template');
const stationTemplate = document.getElementById('station-template');

function validateInt(value, min, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildTimeline() {
  const timeline = [];

  state.groups.forEach((group, groupIndex) => {
    const rounds = validateInt(group.rounds, 1, 1);

    for (let round = 1; round <= rounds; round += 1) {
      group.stations.forEach((station, stationIndex) => {
        timeline.push({
          type: 'work',
          name: station.name,
          seconds: validateInt(station.seconds, 5, 30),
          groupName: group.name,
          groupIndex,
          stationIndex,
          round,
          rounds,
        });

        const restSeconds = validateInt(station.restSeconds, 0, 0);
        if (restSeconds > 0) {
          timeline.push({
            type: 'rest',
            name: `Rest`,
            seconds: restSeconds,
            groupName: group.name,
            groupIndex,
            stationIndex,
            round,
            rounds,
          });
        }
      });
    }
  });

  state.timeline = timeline;
}

function currentBlock() {
  return state.timeline[state.currentIndex];
}

function clampAndSyncBlock() {
  buildTimeline();

  if (!state.timeline.length) {
    state.currentIndex = 0;
    state.remainingMs = 0;
    stopTimer();
    render();
    return;
  }

  if (state.currentIndex >= state.timeline.length) {
    state.currentIndex = state.timeline.length - 1;
  }

  const blockMs = currentBlock().seconds * 1000;
  state.remainingMs = Math.min(state.remainingMs || blockMs, blockMs);
  render();
}

function setBlock(index) {
  if (!state.timeline.length) return;
  state.currentIndex = (index + state.timeline.length) % state.timeline.length;
  state.remainingMs = currentBlock().seconds * 1000;
  state.previousTick = performance.now();
  render();
}

function tick() {
  if (!state.running || !state.timeline.length) return;

  const now = performance.now();
  const elapsed = now - state.previousTick;
  state.previousTick = now;
  state.remainingMs -= elapsed;

  if (state.remainingMs <= 0) {
    const carry = Math.abs(state.remainingMs);
    setBlock(state.currentIndex + 1);
    state.remainingMs = Math.max(0, currentBlock().seconds * 1000 - carry);
  }

  render();
}

function stopTimer() {
  state.running = false;
  startBtn.textContent = 'Start';
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  if (!state.timeline.length) return;
  state.running = true;
  state.previousTick = performance.now();
  startBtn.textContent = 'Pause';
  if (!state.timerId) {
    state.timerId = setInterval(tick, 100);
  }
}

function ensureAtLeastOneStation(group) {
  if (!group.stations.length) {
    group.stations.push({ name: 'New station', seconds: 30, restSeconds: 15 });
  }
}

function renderEditor() {
  groupListEl.innerHTML = '';

  state.groups.forEach((group, groupIndex) => {
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    const groupNameInput = groupNode.querySelector('.group-name-input');
    const groupRoundsInput = groupNode.querySelector('.group-rounds-input');
    const addStationBtn = groupNode.querySelector('.add-station-btn');
    const deleteGroupBtn = groupNode.querySelector('.delete-group-btn');
    const stationList = groupNode.querySelector('.station-list');

    groupNameInput.value = group.name;
    groupRoundsInput.value = group.rounds;

    groupNameInput.addEventListener('input', (event) => {
      state.groups[groupIndex].name = event.target.value || `Group ${groupIndex + 1}`;
      clampAndSyncBlock();
    });

    groupRoundsInput.addEventListener('change', (event) => {
      const rounds = validateInt(event.target.value, 1, 1);
      event.target.value = rounds;
      state.groups[groupIndex].rounds = rounds;
      clampAndSyncBlock();
    });

    addStationBtn.addEventListener('click', () => {
      state.groups[groupIndex].stations.push({
        name: `Station ${state.groups[groupIndex].stations.length + 1}`,
        seconds: 30,
        restSeconds: 15,
      });
      renderEditor();
      clampAndSyncBlock();
    });

    deleteGroupBtn.addEventListener('click', () => {
      if (state.groups.length === 1) {
        state.groups[0] = {
          name: 'Group 1',
          rounds: 1,
          stations: [{ name: 'New station', seconds: 30, restSeconds: 15 }],
        };
      } else {
        state.groups.splice(groupIndex, 1);
      }

      renderEditor();
      clampAndSyncBlock();
    });

    group.stations.forEach((station, stationIndex) => {
      const stationNode = stationTemplate.content.firstElementChild.cloneNode(true);
      const stationNameInput = stationNode.querySelector('.station-name-input');
      const stationWorkInput = stationNode.querySelector('.station-work-input');
      const stationRestInput = stationNode.querySelector('.station-rest-input');
      const deleteStationBtn = stationNode.querySelector('.delete-station-btn');

      stationNameInput.value = station.name;
      stationWorkInput.value = station.seconds;
      stationRestInput.value = station.restSeconds;

      stationNameInput.addEventListener('input', (event) => {
        state.groups[groupIndex].stations[stationIndex].name = event.target.value || `Station ${stationIndex + 1}`;
        clampAndSyncBlock();
      });

      stationWorkInput.addEventListener('change', (event) => {
        const seconds = validateInt(event.target.value, 5, 30);
        event.target.value = seconds;
        state.groups[groupIndex].stations[stationIndex].seconds = seconds;
        clampAndSyncBlock();
      });

      stationRestInput.addEventListener('change', (event) => {
        const restSeconds = validateInt(event.target.value, 0, 0);
        event.target.value = restSeconds;
        state.groups[groupIndex].stations[stationIndex].restSeconds = restSeconds;
        clampAndSyncBlock();
      });

      deleteStationBtn.addEventListener('click', () => {
        state.groups[groupIndex].stations.splice(stationIndex, 1);
        ensureAtLeastOneStation(state.groups[groupIndex]);
        renderEditor();
        clampAndSyncBlock();
      });

      stationList.append(stationNode);
    });

    groupListEl.append(groupNode);
  });
}

function render() {
  if (!state.timeline.length) {
    phaseLabelEl.textContent = 'No workout configured';
    stepNameEl.textContent = 'Add a group and station';
    groupMetaEl.textContent = 'Use the editor to begin.';
    timeLeftEl.textContent = '00:00';
    stepCountEl.textContent = '0 / 0';
    progressBarEl.style.width = '0%';
    return;
  }

  const block = currentBlock();
  const durationMs = block.seconds * 1000;
  const width = Math.max(0, Math.min(100, (state.remainingMs / durationMs) * 100));

  phaseLabelEl.textContent = block.type === 'rest' ? 'Rest interval' : 'Work interval';
  stepNameEl.textContent = block.type === 'rest' ? `Rest after ${state.groups[block.groupIndex].stations[block.stationIndex].name}` : block.name;
  groupMetaEl.textContent = `${block.groupName} · Round ${block.round}/${block.rounds}`;
  timeLeftEl.textContent = formatTime(state.remainingMs);
  stepCountEl.textContent = `${state.currentIndex + 1} / ${state.timeline.length}`;
  progressBarEl.style.width = `${width}%`;
  progressBarEl.style.background =
    block.type === 'rest'
      ? 'linear-gradient(90deg, rgba(255,255,255,0.6), rgba(143,226,255,0.7))'
      : 'linear-gradient(90deg, var(--accent), var(--accent-2))';
}

startBtn.addEventListener('click', () => {
  if (state.running) {
    stopTimer();
  } else {
    startTimer();
  }
});

prevBtn.addEventListener('click', () => setBlock(state.currentIndex - 1));
nextBtn.addEventListener('click', () => setBlock(state.currentIndex + 1));
resetBtn.addEventListener('click', () => {
  stopTimer();
  setBlock(0);
});

addGroupBtn.addEventListener('click', () => {
  state.groups.push({
    name: `Group ${state.groups.length + 1}`,
    rounds: 1,
    stations: [{ name: 'New station', seconds: 30, restSeconds: 15 }],
  });
  renderEditor();
  clampAndSyncBlock();
});

buildTimeline();
state.remainingMs = state.timeline.length ? currentBlock().seconds * 1000 : 0;
renderEditor();
render();
