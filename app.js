/* ============================================================
   IronCoach — Personal Training Tracker PWA
   ============================================================ */

// ---- Service Worker Registration ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---- Offline detection ----
function updateOnlineStatus() {
  document.getElementById('offlineBanner').classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---- Utility ----
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

// ---- Storage ----
const Store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

// ---- Default Programme Data ----
function getDefaultProgramme() {
  return [
    {
      name: 'Upper A',
      day: 'Monday',
      subtitle: 'Strength Focus',
      defaultRest: 180,
      exercises: [
        { name: 'Barbell Bench Press', notes: 'Control the descent, pause 1 sec at chest.', defaultRest: 180,
          sets: [
            { targetReps: 3, targetWeight: 72.5, repRange: '3' },
            { targetReps: 8, targetWeight: 72.5, repRange: '6-8' },
            { targetReps: 8, targetWeight: 72.5, repRange: '6-8' }
          ]},
        { name: 'Incline Dumbbell Press', notes: 'Per hand', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 30, repRange: '6-8' },
            { targetReps: 8, targetWeight: 30, repRange: '6-8' }
          ]},
        { name: 'Chest Supported Dumbbell Row', notes: 'Drive elbows up, squeeze shoulder blades. Per hand.', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 35, repRange: '6-8' },
            { targetReps: 8, targetWeight: 35, repRange: '6-8' }
          ]},
        { name: 'Seated Shoulder Press Machine (Gymleco)', notes: '', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
            { targetReps: 8, targetWeight: 37.5, repRange: '6-8' }
          ]},
        { name: 'Cable Lateral Raise (cross body)', notes: '', defaultRest: 90,
          sets: [
            { targetReps: 10, targetWeight: 15, repRange: '8-10' },
            { targetReps: 10, targetWeight: 15, repRange: '8-10' },
            { targetReps: 15, targetWeight: 10, repRange: '10-15' }
          ]},
        { name: 'Rear Delt Row', notes: 'Use yoga block for ROM', defaultRest: 120,
          sets: [
            { targetReps: 12, targetWeight: 47.5, repRange: '8-12' },
            { targetReps: 12, targetWeight: 47.5, repRange: '8-12' },
            { targetReps: 12, targetWeight: 47.5, repRange: '8-12' }
          ]},
        { name: 'Cable Tricep Pushdown (straight bar)', notes: '', defaultRest: 90,
          sets: [
            { targetReps: 8, targetWeight: 65, repRange: '6-8' },
            { targetReps: 8, targetWeight: 65, repRange: '6-8' },
            { targetReps: 12, targetWeight: 50, repRange: '8-12' }
          ]}
      ]
    },
    {
      name: 'Lower A',
      day: 'Tuesday',
      subtitle: 'Quad/Glute Dominant',
      defaultRest: 150,
      exercises: [
        { name: 'Seated Hip Abduction', notes: 'Warm-up set, full ROM, controlled.', defaultRest: 90,
          sets: [
            { targetReps: 12, targetWeight: 105, repRange: '10-12' },
            { targetReps: 12, targetWeight: 105, repRange: '10-12' }
          ]},
        { name: 'Leg Press', notes: '', defaultRest: 180,
          sets: [
            { targetReps: 8, targetWeight: 200, repRange: '6-8' },
            { targetReps: 12, targetWeight: 170, repRange: '8-12' }
          ]},
        { name: 'Machine Hip Thrust', notes: 'Full hip extension at top, squeeze glutes.', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 102.5, repRange: '6-8' },
            { targetReps: 8, targetWeight: 102.5, repRange: '6-8' }
          ]},
        { name: 'Seated Knee Extension (tri-set)', notes: 'Bottom / Mid / Top positions', defaultRest: 120,
          sets: [
            { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' },
            { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' }
          ]},
        { name: 'Romanian Deadlift', notes: 'Hinge at hips, bar close to body, flat back.', defaultRest: 180,
          sets: [
            { targetReps: 8, targetWeight: 107.5, repRange: '6-8' },
            { targetReps: 12, targetWeight: 100, repRange: '8-12' }
          ]},
        { name: 'Machine Crunch', notes: '', defaultRest: 60,
          sets: [
            { targetReps: 20, targetWeight: 97.5, repRange: '15-20' },
            { targetReps: 20, targetWeight: 97.5, repRange: '15-20' }
          ]},
        { name: '10 Minute Bike', notes: 'Cool down, moderate pace', defaultRest: 0,
          sets: [
            { targetReps: 1, targetWeight: 0, repRange: '10min' }
          ]}
      ]
    },
    {
      name: 'Upper B',
      day: 'Thursday',
      subtitle: 'Hypertrophy Volume Focus',
      defaultRest: 150,
      exercises: [
        { name: 'Incline Chest Press Machine (plate loaded)', notes: '', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 40, repRange: '6-8' },
            { targetReps: 12, targetWeight: 32.5, repRange: '8-12' }
          ]},
        { name: 'Plate Loaded Lat Pulldown', notes: 'Mid/Top position', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 65, repRange: '6-8', note: '65kg mid / 40kg top' },
            { targetReps: 12, targetWeight: 50, repRange: '8-12', note: '50kg mid / 20kg top' }
          ]},
        { name: 'Standing Cable Fly', notes: '', defaultRest: 120,
          sets: [
            { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
            { targetReps: 12, targetWeight: 32.5, repRange: '8-12' }
          ]},
        { name: 'Seated Row Machine (Pannatta)', notes: 'Chest supported, full stretch at extension.', defaultRest: 120,
          sets: [
            { targetReps: 12, targetWeight: 37.5, repRange: '8-12' },
            { targetReps: 12, targetWeight: 37.5, repRange: '8-12' }
          ]},
        { name: 'Cable Cross Body Lateral Raise', notes: '', defaultRest: 90,
          sets: [
            { targetReps: 10, targetWeight: 15, repRange: '8-10' },
            { targetReps: 10, targetWeight: 15, repRange: '8-10' },
            { targetReps: 15, targetWeight: 10, repRange: '12-15' }
          ]},
        { name: 'Rear Delt Row', notes: '', defaultRest: 90,
          sets: [
            { targetReps: 12, targetWeight: 45, repRange: '10-12' },
            { targetReps: 12, targetWeight: 45, repRange: '10-12' },
            { targetReps: 12, targetWeight: 45, repRange: '10-12' }
          ]},
        { name: 'Dumbbell Hammer Curl', notes: 'Per hand', defaultRest: 90,
          sets: [
            { targetReps: 12, targetWeight: 20, repRange: '8-12' },
            { targetReps: 12, targetWeight: 20, repRange: '8-12' }
          ]},
        { name: 'Cable Tricep Pushdown', notes: '', defaultRest: 90,
          sets: [
            { targetReps: 15, targetWeight: 50, repRange: '10-15' },
            { targetReps: 15, targetWeight: 50, repRange: '10-15' }
          ]}
      ]
    },
    {
      name: 'Lower B',
      day: 'Friday',
      subtitle: 'Posterior Chain Focus',
      defaultRest: 150,
      exercises: [
        { name: 'Laying Hamstring Curl', notes: '2 RIR, controlled descent.', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 62.5, repRange: '6-8' },
            { targetReps: 8, targetWeight: 62.5, repRange: '6-8' }
          ]},
        { name: '45 Degree Hyper Extension', notes: 'Hamstring focus, dumbbell', defaultRest: 120,
          sets: [
            { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
            { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
            { targetReps: 15, targetWeight: 7.5, repRange: '10-15' }
          ]},
        { name: 'Romanian Deadlift', notes: 'Hinge at hips, bar close to body, flat back.', defaultRest: 180,
          sets: [
            { targetReps: 8, targetWeight: 107.5, repRange: '6-8' },
            { targetReps: 12, targetWeight: 100, repRange: '8-12' }
          ]},
        { name: 'Machine Hip Thrust', notes: 'Higher rep version', defaultRest: 120,
          sets: [
            { targetReps: 12, targetWeight: 100, repRange: '8-12' },
            { targetReps: 12, targetWeight: 100, repRange: '8-12' }
          ]},
        { name: 'Seated Knee Extension (tri-set)', notes: 'Bottom / Mid / Top positions', defaultRest: 120,
          sets: [
            { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' },
            { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' }
          ]},
        { name: 'Machine Crunch', notes: '', defaultRest: 60,
          sets: [
            { targetReps: 20, targetWeight: 95, repRange: '15-20' },
            { targetReps: 20, targetWeight: 95, repRange: '15-20' }
          ]},
        { name: '10 Minute Bike', notes: 'Cool down, moderate pace', defaultRest: 0,
          sets: [
            { targetReps: 1, targetWeight: 0, repRange: '10min' }
          ]}
      ]
    },
    {
      name: 'Upper C',
      day: 'Saturday',
      subtitle: 'Power/Variation + Arms',
      defaultRest: 150,
      exercises: [
        { name: 'Barbell Bench Press', notes: 'Heavier/lower rep variation', defaultRest: 210,
          sets: [
            { targetReps: 6, targetWeight: 77.5, repRange: '4-6' },
            { targetReps: 6, targetWeight: 77.5, repRange: '4-6' }
          ]},
        { name: 'Chest Supported Dumbbell Row', notes: 'Heavy, per hand', defaultRest: 150,
          sets: [
            { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
            { targetReps: 8, targetWeight: 37.5, repRange: '6-8' }
          ]},
        { name: 'Dumbbell Shoulder Press (standing)', notes: 'Functional variation, per hand', defaultRest: 150,
          sets: [
            { targetReps: 10, targetWeight: 22.5, repRange: '8-10' },
            { targetReps: 10, targetWeight: 22.5, repRange: '8-10' }
          ]},
        { name: 'EZ Bar Bicep Curl', notes: 'Total bar weight', defaultRest: 90,
          sets: [
            { targetReps: 12, targetWeight: 32.5, repRange: '8-12' },
            { targetReps: 12, targetWeight: 32.5, repRange: '8-12' },
            { targetReps: 15, targetWeight: 25, repRange: '12-15' }
          ]},
        { name: 'Dumbbell Bicep Curl (supinating)', notes: 'Per hand', defaultRest: 90,
          sets: [
            { targetReps: 12, targetWeight: 20, repRange: '8-12' },
            { targetReps: 12, targetWeight: 20, repRange: '8-12' }
          ]},
        { name: 'Overhead Tricep Extension', notes: 'Cable or dumbbell', defaultRest: 90,
          sets: [
            { targetReps: 15, targetWeight: 22.5, repRange: '10-15' },
            { targetReps: 15, targetWeight: 22.5, repRange: '10-15' }
          ]},
        { name: 'Cable Lateral Raise', notes: '', defaultRest: 60,
          sets: [
            { targetReps: 15, targetWeight: 12.5, repRange: '12-15' },
            { targetReps: 15, targetWeight: 12.5, repRange: '12-15' },
            { targetReps: 15, targetWeight: 10, repRange: '12-15' }
          ]}
      ]
    }
  ];
}

const SCHEDULE = {
  1: 'Upper A',   // Monday
  2: 'Lower A',   // Tuesday
  3: null,         // Wednesday rest
  4: 'Upper B',   // Thursday
  5: 'Lower B',   // Friday
  6: 'Upper C',   // Saturday
  0: null          // Sunday rest
};

// ---- App State ----
const App = {
  currentScreen: 'today',
  activeSession: null,   // in-progress workout
  workoutStartTime: null,
  restTimer: null,       // { interval, remaining, exerciseIdx }
  workoutElapsedInterval: null,
};

// ---- Init ----
App.init = function() {
  // Seed programme if not exists
  if (!Store.get('ironcoach_programme')) {
    Store.set('ironcoach_programme', getDefaultProgramme());
  }
  // Migrate: remove PT Session label from Upper C
  const _prog = Store.get('ironcoach_programme');
  if (_prog) {
    const _uc = _prog.find(w => w.name === 'Upper C');
    if (_uc && _uc.subtitle.includes('PT Session')) {
      _uc.subtitle = 'Power/Variation + Arms';
      const _bench = _uc.exercises.find(e => e.name === 'Barbell Bench Press');
      if (_bench && _bench.notes.includes('PT')) _bench.notes = 'Heavier/lower rep variation';
      Store.set('ironcoach_programme', _prog);
    }
  }
  if (!Store.get('ironcoach_sessions')) {
    Store.set('ironcoach_sessions', []);
  }
  if (!Store.get('ironcoach_settings')) {
    Store.set('ironcoach_settings', { apiKey: '', units: 'kg', userName: '' });
  }

  // Load settings into UI
  const settings = Store.get('ironcoach_settings');
  document.getElementById('settingName').value = settings.userName || '';
  document.getElementById('settingUnits').value = settings.units || 'kg';
  document.getElementById('settingApiKey').value = settings.apiKey || '';

  // Check for in-progress session
  const saved = Store.get('ironcoach_active_session');
  if (saved) {
    App.activeSession = saved.session;
    App.workoutStartTime = saved.startTime;
  }

  App.today.render();
  App.history.render();
  App.programme.render();
};

// ---- Navigation ----
App.nav = function(screen) {
  App.currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));

  if (screen === 'history') App.history.render();
  if (screen === 'programme') App.programme.render();
};

// ---- TODAY SCREEN ----
App.today = {};

App.today.getTodayWorkout = function() {
  const dow = new Date().getDay();
  const workoutName = SCHEDULE[dow];
  if (!workoutName) return null;
  const programme = Store.get('ironcoach_programme') || [];
  return programme.find(w => w.name === workoutName) || null;
};

App.today.render = function() {
  const container = document.getElementById('todayContent');
  const workout = App.today.getTodayWorkout();

  if (App.activeSession) {
    App.today.renderActiveSession(container);
    return;
  }

  if (!workout) {
    container.innerHTML = `
      <div class="rest-day-msg">
        <h2>Rest Day</h2>
        <p>Recovery is part of the programme. Come back stronger tomorrow.</p>
        <button class="btn btn-outline" style="margin-top:24px" onclick="App.today.startAnyWorkout()">Start a workout anyway</button>
      </div>`;
    document.getElementById('finishFab').classList.remove('show');
    return;
  }

  const settings = Store.get('ironcoach_settings') || {};
  const greeting = settings.userName ? `Hey ${settings.userName}` : 'Today';

  container.innerHTML = `
    <h1 class="screen-title">${greeting}</h1>
    <div class="card">
      <h2 style="font-size:20px;font-weight:700;">${workout.name}</h2>
      <p style="font-size:14px;color:var(--text-dim);margin-top:2px;">${workout.subtitle} — ${workout.day}</p>
      <p style="font-size:13px;color:var(--text-dim);margin-top:4px;">${workout.exercises.length} exercises</p>
      <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="App.today.startWorkout('${workout.name}')">
        Start Workout
      </button>
    </div>
    <button class="btn btn-outline btn-block" onclick="App.today.startAnyWorkout()">Choose a different workout</button>`;
  document.getElementById('finishFab').classList.remove('show');
};

App.today.startAnyWorkout = function() {
  const programme = Store.get('ironcoach_programme') || [];
  let html = '<h2>Choose Workout</h2>';
  programme.forEach(w => {
    html += `<button class="btn btn-outline btn-block" style="margin-top:10px" onclick="App.today.startWorkout('${w.name}');App.modal.forceClose();">${w.name} — ${w.subtitle}</button>`;
  });
  App.modal.open(html);
};

App.today.startWorkout = function(name) {
  const programme = Store.get('ironcoach_programme') || [];
  const template = programme.find(w => w.name === name);
  if (!template) return;

  App.activeSession = {
    id: uuid(),
    date: new Date().toISOString(),
    workoutName: template.name,
    durationMinutes: 0,
    exercises: template.exercises.map(ex => ({
      name: ex.name,
      notes: ex.notes || '',
      defaultRest: ex.defaultRest || template.defaultRest || 120,
      rpe: null,
      sets: ex.sets.map(s => ({
        targetReps: s.targetReps,
        targetWeight: s.targetWeight,
        repRange: s.repRange || '',
        note: s.note || '',
        actualReps: s.targetReps,
        actualWeight: s.targetWeight,
        status: null
      }))
    }))
  };
  App.workoutStartTime = Date.now();
  App.today.saveActive();
  App.today.renderActiveSession(document.getElementById('todayContent'));
  App.today.startElapsedTimer();
};

App.today.saveActive = function() {
  Store.set('ironcoach_active_session', {
    session: App.activeSession,
    startTime: App.workoutStartTime
  });
};

App.today.startElapsedTimer = function() {
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  App.workoutElapsedInterval = setInterval(() => {
    const el = document.getElementById('workoutElapsed');
    if (el && App.workoutStartTime) {
      const elapsed = Math.floor((Date.now() - App.workoutStartTime) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
  }, 1000);
};

App.today.renderActiveSession = function(container) {
  const session = App.activeSession;
  const settings = Store.get('ironcoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = `
    <div class="workout-header">
      <div>
        <h2>${session.workoutName}</h2>
        <div style="font-size:13px;color:var(--text-dim);">${formatDate(session.date)}</div>
      </div>
      <div class="workout-timer-display" id="workoutElapsed">0:00</div>
    </div>`;

  session.exercises.forEach((ex, ei) => {
    const allDone = ex.sets.every(s => s.status !== null);
    const hasFail = ex.sets.some(s => s.status === 'failed');
    const doneCount = ex.sets.filter(s => s.status !== null).length;

    let cardClass = 'exercise-card';
    if (allDone) cardClass += hasFail ? ' completed has-failure' : ' completed';

    let badge = '';
    if (allDone) {
      badge = `<span class="exercise-status-badge badge-done">Done</span>`;
    } else if (doneCount > 0) {
      badge = `<span class="exercise-status-badge badge-partial">${doneCount}/${ex.sets.length}</span>`;
    }

    // Summary for collapsed state
    let summaryParts = [];
    ex.sets.forEach((s, si) => {
      if (s.status === 'done') summaryParts.push(`${s.actualWeight}${unit} x ${s.actualReps}`);
      else if (s.status === 'failed') summaryParts.push(`${s.actualWeight}${unit} x ${s.actualReps} (F)`);
      else if (s.status === 'skipped') summaryParts.push('Skipped');
    });

    html += `
    <div class="${cardClass}" id="exCard${ei}">
      <div class="exercise-header" onclick="App.today.toggleExercise(${ei})">
        <span class="exercise-name">${ex.name}</span>
        ${badge}
      </div>
      <div class="exercise-summary">${summaryParts.join(' | ')}</div>
      <div class="exercise-body">`;

    if (ex.notes) {
      html += `<div class="exercise-notes">${ex.notes}</div>`;
    }

    ex.sets.forEach((s, si) => {
      let rowClass = 'set-row';
      if (s.status === 'done') rowClass += ' set-done';
      if (s.status === 'failed') rowClass += ' set-failed';
      if (s.status === 'skipped') rowClass += ' set-done';

      const targetLabel = s.note
        ? s.note
        : (s.targetWeight > 0 ? `${s.repRange} @ ${s.targetWeight}${unit}` : s.repRange);

      html += `
        <div class="${rowClass}" id="setRow${ei}_${si}">
          <div class="set-info">
            <div class="set-label">S${si + 1}</div>
            <div class="set-target">${targetLabel}</div>
          </div>
          <div class="set-inputs">
            <input type="number" id="setW${ei}_${si}" value="${s.actualWeight}" step="0.5" inputmode="decimal"
              ${s.status ? 'disabled' : ''} onchange="App.today.updateSet(${ei},${si},'weight',this.value)">
            <span class="unit-label">${unit}</span>
            <span class="unit-label">x</span>
            <input type="number" id="setR${ei}_${si}" value="${s.actualReps}" step="1" inputmode="numeric"
              ${s.status ? 'disabled' : ''} onchange="App.today.updateSet(${ei},${si},'reps',this.value)">
            <span class="unit-label">reps</span>
          </div>
          <div class="set-actions">
            <button class="set-btn set-btn-done ${s.status === 'done' ? 'active' : ''}"
              onclick="App.today.markSet(${ei},${si},'done')" ${s.status ? 'disabled' : ''}>&#10003;</button>
            <button class="set-btn set-btn-fail ${s.status === 'failed' ? 'active' : ''}"
              onclick="App.today.markSet(${ei},${si},'failed')" ${s.status ? 'disabled' : ''}>&#10007;</button>
            <button class="set-btn set-btn-skip ${s.status === 'skipped' ? 'active' : ''}"
              onclick="App.today.markSet(${ei},${si},'skipped')" ${s.status ? 'disabled' : ''}>S</button>
          </div>
        </div>`;
    });

    // RPE + rest timer
    const restSecs = ex.defaultRest || 120;
    html += `
        <div class="exercise-footer">
          <div class="rpe-selector">
            <label>RPE</label>
            <select onchange="App.today.setRpe(${ei}, this.value)">
              <option value="">-</option>
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${ex.rpe == n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="rest-timer-area">
            <div class="rest-presets">
              ${[60,90,120,180].map(t => {
                const label = t >= 120 ? `${t/60}min` : `${t}s`;
                return `<button class="rest-preset-btn ${restSecs === t ? 'active' : ''}" onclick="App.today.setRestPreset(${ei},${t})">${label}</button>`;
              }).join('')}
            </div>
            <div class="rest-timer-display" id="restDisplay${ei}">
              ${App.today.formatRestTime(restSecs)}
            </div>
            <button class="rest-btn" id="restBtn${ei}" onclick="App.today.toggleRest(${ei})">Start</button>
          </div>
        </div>
      </div>
    </div>`;
  });

  container.innerHTML = html;

  // Show/hide finish FAB
  App.today.checkFinish();
  App.today.startElapsedTimer();
};

App.today.formatRestTime = function(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

App.today.toggleExercise = function(ei) {
  const card = document.getElementById('exCard' + ei);
  if (!card) return;
  if (card.classList.contains('completed')) {
    card.classList.remove('completed');
  }
};

App.today.updateSet = function(ei, si, field, value) {
  if (!App.activeSession) return;
  const s = App.activeSession.exercises[ei].sets[si];
  if (field === 'weight') s.actualWeight = parseFloat(value) || 0;
  if (field === 'reps') s.actualReps = parseInt(value) || 0;
  App.today.saveActive();
};

App.today.markSet = function(ei, si, status) {
  if (!App.activeSession) return;
  const s = App.activeSession.exercises[ei].sets[si];

  // Read current input values before marking
  const wInput = document.getElementById(`setW${ei}_${si}`);
  const rInput = document.getElementById(`setR${ei}_${si}`);
  if (wInput) s.actualWeight = parseFloat(wInput.value) || 0;
  if (rInput) s.actualReps = parseInt(rInput.value) || 0;

  s.status = status;
  App.today.saveActive();

  // Re-render the card area
  App.today.renderActiveSession(document.getElementById('todayContent'));

  // Auto-start rest timer if set is done or failed
  if (status === 'done' || status === 'failed') {
    App.today.toggleRest(ei);
  }
};

App.today.setRpe = function(ei, value) {
  if (!App.activeSession) return;
  App.activeSession.exercises[ei].rpe = value ? parseInt(value) : null;
  App.today.saveActive();
};

App.today.setRestPreset = function(ei, secs) {
  if (!App.activeSession) return;
  App.activeSession.exercises[ei].defaultRest = secs;
  App.today.saveActive();

  // Update display if not running
  if (!App.restTimer || App.restTimer.exerciseIdx !== ei) {
    const display = document.getElementById('restDisplay' + ei);
    if (display) display.textContent = App.today.formatRestTime(secs);
  }

  // Update preset buttons
  document.querySelectorAll(`#exCard${ei} .rest-preset-btn`).forEach(btn => {
    btn.classList.remove('active');
  });
  const presets = document.querySelectorAll(`#exCard${ei} .rest-preset-btn`);
  [60,90,120,180].forEach((t, i) => {
    if (t === secs && presets[i]) presets[i].classList.add('active');
  });
};

App.today.toggleRest = function(ei) {
  // Stop any existing timer
  if (App.restTimer) {
    clearInterval(App.restTimer.interval);
    const prevDisplay = document.getElementById('restDisplay' + App.restTimer.exerciseIdx);
    if (prevDisplay) prevDisplay.classList.remove('ringing');
    const prevBtn = document.getElementById('restBtn' + App.restTimer.exerciseIdx);
    if (prevBtn) prevBtn.textContent = 'Start';
    App.restTimer = null;
  }

  const ex = App.activeSession.exercises[ei];
  const total = ex.defaultRest || 120;
  let remaining = total;

  const display = document.getElementById('restDisplay' + ei);
  const btn = document.getElementById('restBtn' + ei);
  if (!display || !btn) return;

  display.textContent = App.today.formatRestTime(remaining);
  display.classList.remove('ringing');
  btn.textContent = 'Stop';

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(interval);
      display.textContent = '0:00';
      display.classList.add('ringing');
      btn.textContent = 'Start';
      App.restTimer = null;

      // Vibrate
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);

      // Audio ping for background
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch(e) {}

      return;
    }
    display.textContent = App.today.formatRestTime(remaining);
  }, 1000);

  App.restTimer = { interval, remaining, exerciseIdx: ei };
};

App.today.checkFinish = function() {
  if (!App.activeSession) return;
  const allDone = App.activeSession.exercises.every(ex =>
    ex.sets.every(s => s.status !== null)
  );
  document.getElementById('finishFab').classList.toggle('show', allDone);
};

App.today.finishWorkout = function() {
  if (!App.activeSession) return;

  // Calculate duration
  const elapsed = Math.round((Date.now() - App.workoutStartTime) / 60000);
  App.activeSession.durationMinutes = elapsed;

  // Clean up session object for storage
  const session = {
    id: App.activeSession.id,
    date: App.activeSession.date,
    workoutName: App.activeSession.workoutName,
    durationMinutes: elapsed,
    exercises: App.activeSession.exercises.map(ex => ({
      name: ex.name,
      notes: ex.notes,
      rpe: ex.rpe,
      sets: ex.sets.map(s => ({
        targetReps: s.targetReps,
        targetWeight: s.targetWeight,
        actualReps: s.actualReps,
        actualWeight: s.actualWeight,
        status: s.status
      }))
    }))
  };

  // Save to sessions
  const sessions = Store.get('ironcoach_sessions') || [];
  sessions.push(session);
  Store.set('ironcoach_sessions', sessions);

  // Build summary
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.status === 'done').length, 0);
  const failedSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.status === 'failed').length, 0);
  const totalVolume = session.exercises.reduce((a, e) =>
    a + e.sets.filter(s => s.status === 'done').reduce((b, s) => b + (s.actualWeight * s.actualReps), 0)
  , 0);

  const summaryHtml = `
    <h2>Workout Complete!</h2>
    <div style="margin:16px 0;">
      <div class="workout-complete-stat"><span class="stat-label">Workout</span><span class="stat-value">${session.workoutName}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Duration</span><span class="stat-value">${formatDuration(elapsed)}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Sets Completed</span><span class="stat-value">${doneSets}/${totalSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Failed Sets</span><span class="stat-value">${failedSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Total Volume</span><span class="stat-value">${Math.round(totalVolume).toLocaleString()} kg</span></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="App.modal.forceClose()">Done</button>`;

  App.modal.open(summaryHtml);

  // Clear active
  App.activeSession = null;
  App.workoutStartTime = null;
  localStorage.removeItem('ironcoach_active_session');
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  if (App.restTimer) { clearInterval(App.restTimer.interval); App.restTimer = null; }
  document.getElementById('finishFab').classList.remove('show');

  App.today.render();
};

// ---- HISTORY SCREEN ----
App.history = {};

App.history.render = function() {
  const container = document.getElementById('historyContent');
  const sessions = (Store.get('ironcoach_sessions') || []).slice().reverse();

  if (sessions.length === 0) {
    container.innerHTML = '<div class="history-empty"><p>No sessions yet. Start your first workout!</p></div>';
    return;
  }

  const settings = Store.get('ironcoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = '';
  sessions.forEach((s, idx) => {
    const totalVol = s.exercises.reduce((a, e) =>
      a + e.sets.filter(set => set.status === 'done').reduce((b, set) => b + set.actualWeight * set.actualReps, 0)
    , 0);
    const doneSets = s.exercises.reduce((a, e) => a + e.sets.filter(set => set.status === 'done').length, 0);
    const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);

    html += `
    <div class="history-item" id="histItem${idx}" onclick="App.history.toggle(${idx})">
      <div class="history-date">${formatDate(s.date)}</div>
      <div class="history-name">${s.workoutName}</div>
      <div class="history-meta">
        <span>${formatDuration(s.durationMinutes)}</span>
        <span>${doneSets}/${totalSets} sets</span>
        <span>${Math.round(totalVol).toLocaleString()} ${unit}</span>
      </div>
      <div class="history-detail">`;

    s.exercises.forEach(ex => {
      html += `<div class="history-exercise-block">
        <div class="history-exercise-name">
          ${ex.name}
          <button class="history-chart-btn" onclick="event.stopPropagation();App.chart.show('${ex.name.replace(/'/g, "\\'")}')">Chart</button>
        </div>`;
      ex.sets.forEach((set, si) => {
        let cls = 'history-set-line';
        if (set.status === 'failed') cls += ' failed';
        if (set.status === 'skipped') cls += ' skipped';
        const statusIcon = set.status === 'done' ? '' : set.status === 'failed' ? ' (Failed)' : ' (Skipped)';
        html += `<div class="${cls}">Set ${si+1}: ${set.actualWeight}${unit} x ${set.actualReps}${statusIcon}</div>`;
      });
      if (ex.rpe) html += `<div class="history-rpe">RPE: ${ex.rpe}</div>`;
      html += '</div>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
};

App.history.toggle = function(idx) {
  document.getElementById('histItem' + idx).classList.toggle('expanded');
};

// ---- CHART ----
App.chart = {};

App.chart.show = function(exerciseName) {
  const sessions = Store.get('ironcoach_sessions') || [];
  const dataPoints = [];

  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      if (ex.name === exerciseName) {
        const maxWeight = Math.max(...ex.sets.filter(set => set.status === 'done').map(set => set.actualWeight), 0);
        if (maxWeight > 0) {
          dataPoints.push({ date: new Date(s.date), weight: maxWeight });
        }
      }
    });
  });

  if (dataPoints.length < 1) return;

  document.getElementById('chartTitle').textContent = exerciseName;
  document.getElementById('chartModal').classList.add('show');

  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  if (dataPoints.length === 1) {
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${dataPoints[0].weight} kg`, W / 2, H / 2);
    return;
  }

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const weights = dataPoints.map(d => d.weight);
  const minW = Math.min(...weights) * 0.95;
  const maxW = Math.max(...weights) * 1.05;
  const settings = Store.get('ironcoach_settings') || {};
  const unit = settings.units || 'kg';

  // Axes
  ctx.strokeStyle = '#2d2d44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, H - padding.bottom);
  ctx.lineTo(W - padding.right, H - padding.bottom);
  ctx.stroke();

  // Y labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const val = minW + (maxW - minW) * (i / ySteps);
    const y = H - padding.bottom - (i / ySteps) * chartH;
    ctx.fillText(val.toFixed(1) + unit, padding.left - 8, y + 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.strokeStyle = '#2d2d44';
    ctx.stroke();
  }

  // X labels (dates)
  ctx.textAlign = 'center';
  const showEvery = Math.max(1, Math.floor(dataPoints.length / 6));
  dataPoints.forEach((d, i) => {
    if (i % showEvery === 0 || i === dataPoints.length - 1) {
      const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
      ctx.fillText(d.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x, H - padding.bottom + 20);
    }
  });

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2.5;
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - ((d.weight - minW) / (maxW - minW)) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - ((d.weight - minW) / (maxW - minW)) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.strokeStyle = '#0f0f1a';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};

App.chart.close = function() {
  document.getElementById('chartModal').classList.remove('show');
};

// ---- PROGRAMME SCREEN ----
App.programme = {};

App.programme.render = function() {
  const container = document.getElementById('programmeContent');
  const programme = Store.get('ironcoach_programme') || [];
  const settings = Store.get('ironcoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = '';
  programme.forEach((w, wi) => {
    html += `
    <div class="programme-day" id="progDay${wi}">
      <div class="programme-day-header" onclick="App.programme.toggle(${wi})">
        <h3>${w.name} <span style="font-weight:400;color:var(--text-dim);font-size:13px;">— ${w.subtitle}</span></h3>
        <span class="day-label">${w.day}</span>
      </div>
      <div class="programme-day-body">`;

    w.exercises.forEach((ex, exi) => {
      const setsDesc = ex.sets.map((s, si) => {
        if (s.note) return `Set ${si+1}: ${s.note}`;
        if (s.targetWeight > 0) return `Set ${si+1}: ${s.repRange} @ ${s.targetWeight}${unit}`;
        return `Set ${si+1}: ${s.repRange}`;
      }).join(', ');

      html += `
        <div class="programme-exercise">
          <div class="programme-ex-name">${ex.name}</div>
          <div class="programme-ex-sets">${setsDesc}</div>
          ${ex.notes ? `<div class="programme-ex-notes">${ex.notes}</div>` : ''}
        </div>`;
    });

    html += `
        <button class="btn btn-outline btn-sm programme-edit-btn" onclick="App.programme.edit(${wi})">Edit</button>
      </div>
    </div>`;
  });

  html += `<button class="btn btn-outline btn-block" style="margin-top:12px" onclick="App.programme.reset()">Reset to Default Programme</button>`;

  container.innerHTML = html;
};

App.programme.toggle = function(wi) {
  document.getElementById('progDay' + wi).classList.toggle('expanded');
};

App.programme.edit = function(wi) {
  const programme = Store.get('ironcoach_programme') || [];
  const w = programme[wi];
  const settings = Store.get('ironcoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = `<h2>Edit ${w.name}</h2>`;

  w.exercises.forEach((ex, exi) => {
    html += `
    <div style="margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border);">
      <div class="form-group">
        <label>Exercise ${exi + 1}</label>
        <input type="text" id="editExName${exi}" value="${ex.name}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="editExNotes${exi}" value="${ex.notes || ''}">
      </div>`;

    ex.sets.forEach((s, si) => {
      html += `
      <div class="edit-set-row">
        <input type="number" id="editSetW${exi}_${si}" value="${s.targetWeight}" step="0.5" placeholder="${unit}">
        <span style="color:var(--text-dim);font-size:13px;">${unit} x</span>
        <input type="number" id="editSetR${exi}_${si}" value="${s.targetReps}" step="1" placeholder="reps">
        <input type="text" id="editSetRange${exi}_${si}" value="${s.repRange || ''}" placeholder="range" style="width:60px;">
      </div>`;
    });

    html += '</div>';
  });

  html += `<button class="btn btn-primary btn-block" onclick="App.programme.saveEdit(${wi})">Save Changes</button>`;
  App.modal.open(html);
};

App.programme.saveEdit = function(wi) {
  const programme = Store.get('ironcoach_programme') || [];
  const w = programme[wi];

  w.exercises.forEach((ex, exi) => {
    const nameInput = document.getElementById('editExName' + exi);
    const notesInput = document.getElementById('editExNotes' + exi);
    if (nameInput) ex.name = nameInput.value;
    if (notesInput) ex.notes = notesInput.value;

    ex.sets.forEach((s, si) => {
      const wInput = document.getElementById(`editSetW${exi}_${si}`);
      const rInput = document.getElementById(`editSetR${exi}_${si}`);
      const rangeInput = document.getElementById(`editSetRange${exi}_${si}`);
      if (wInput) s.targetWeight = parseFloat(wInput.value) || 0;
      if (rInput) s.targetReps = parseInt(rInput.value) || 0;
      if (rangeInput) s.repRange = rangeInput.value;
    });
  });

  Store.set('ironcoach_programme', programme);
  App.modal.forceClose();
  App.programme.render();
};

App.programme.reset = function() {
  if (confirm('Reset programme to defaults? This will overwrite your current programme.')) {
    Store.set('ironcoach_programme', getDefaultProgramme());
    App.programme.render();
  }
};

// ---- AI COACH ----
App.ai = {};

const AI_SYSTEM_PROMPT = `You are an expert strength and hypertrophy coach. The user trains 5 days per week on an Upper/Lower/Upper split, focusing on progressive overload for muscle gain and strength. They use a mix of barbells, dumbbells, cables and machines. Give specific, actionable recommendations with exact weights in kg. Be direct and concise.`;

App.ai.call = async function(userPrompt) {
  const settings = Store.get('ironcoach_settings') || {};
  if (!settings.apiKey) {
    App.ai.showError('Please add your Anthropic API key in Settings first.');
    return null;
  }

  document.getElementById('aiLoading').classList.add('show');
  document.getElementById('aiResponse').classList.remove('show');
  document.getElementById('aiError').classList.remove('show');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || 'No response received.';

    document.getElementById('aiLoading').classList.remove('show');
    document.getElementById('aiResponse').textContent = text;
    document.getElementById('aiResponse').classList.add('show');
    return text;
  } catch (e) {
    document.getElementById('aiLoading').classList.remove('show');
    App.ai.showError(e.message);
    return null;
  }
};

App.ai.showError = function(msg) {
  const el = document.getElementById('aiError');
  el.textContent = msg;
  el.classList.add('show');
};

App.ai.analyse = function() {
  const sessions = Store.get('ironcoach_sessions') || [];
  if (sessions.length === 0) {
    App.ai.showError('No sessions recorded yet. Complete a workout first.');
    return;
  }
  const last = sessions[sessions.length - 1];
  App.ai.call(`Analyse my last training session and give me a performance summary, what to push next time (specific weights), and recovery notes.\n\nSession data:\n${JSON.stringify(last, null, 2)}`);
};

App.ai.overload = function() {
  const sessions = Store.get('ironcoach_sessions') || [];
  if (sessions.length === 0) {
    App.ai.showError('No sessions recorded yet.');
    return;
  }
  const recent = sessions.slice(-20); // last ~4 weeks
  App.ai.call(`Based on my recent training sessions, give me per-exercise progressive overload recommendations. Flag any plateaus (same weight 3+ sessions). Suggest a deload if needed.\n\nRecent sessions:\n${JSON.stringify(recent, null, 2)}`);
};

App.ai.newBlock = function() {
  const sessions = Store.get('ironcoach_sessions') || [];
  const programme = Store.get('ironcoach_programme') || [];
  App.ai.call(`Design a fresh 4-week training block based on my training history and current programme. Keep the 5-day Upper/Lower/Upper split structure. Provide specific exercises, sets, reps, and weights in kg.\n\nCurrent programme:\n${JSON.stringify(programme, null, 2)}\n\nRecent sessions (last 20):\n${JSON.stringify(sessions.slice(-20), null, 2)}`);
};

// ---- SETTINGS ----
App.settings = {};

App.settings.save = function() {
  const settings = {
    userName: document.getElementById('settingName').value.trim(),
    units: document.getElementById('settingUnits').value,
    apiKey: document.getElementById('settingApiKey').value.trim()
  };
  Store.set('ironcoach_settings', settings);

  // Show a brief confirmation
  const btn = document.querySelector('#screen-settings .btn-primary');
  const orig = btn.textContent;
  btn.textContent = 'Saved!';
  btn.style.background = '#22c55e';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
  }, 1500);

  // Re-render today in case name changed
  if (App.currentScreen === 'settings') App.today.render();
};

// ---- DATA IMPORT/EXPORT ----
App.data = {};

App.data.exportData = function() {
  const data = {
    programme: Store.get('ironcoach_programme'),
    sessions: Store.get('ironcoach_sessions'),
    settings: Store.get('ironcoach_settings'),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ironcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

App.data.clearData = function() {
  if (confirm('This will permanently delete ALL your training data. Are you sure?')) {
    if (confirm('Really? This cannot be undone.')) {
      localStorage.removeItem('ironcoach_programme');
      localStorage.removeItem('ironcoach_sessions');
      localStorage.removeItem('ironcoach_active_session');
      App.activeSession = null;
      App.init();
      App.nav('today');
    }
  }
};

// ---- MODAL ----
App.modal = {};

App.modal.open = function(html) {
  document.getElementById('modalSheet').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
};

App.modal.close = function(e) {
  if (e && e.target === document.getElementById('modalOverlay')) {
    App.modal.forceClose();
  }
};

App.modal.forceClose = function() {
  document.getElementById('modalOverlay').classList.remove('show');
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', App.init);
