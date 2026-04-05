/* ============================================================
   Rule Coach — Personal Training Tracker PWA
   ============================================================ */

// ---- Service Worker Registration ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js?v=2').catch(() => {});
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
      name: 'Upper A', day: 'Monday', subtitle: 'Strength Push/Pull', defaultRest: 180,
      exercises: [
        { name: 'Barbell Bench Press', notes: 'Control the descent, pause 1 sec at chest.', defaultRest: 180, sets: [
          { targetReps: 8, targetWeight: 72.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 72.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 72.5, repRange: '6-8' }
        ]},
        { name: 'Lat Pulldown', notes: 'Full stretch at top, drive elbows down. Moderate grip.', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 65, repRange: '6-8' },
          { targetReps: 8, targetWeight: 65, repRange: '6-8' },
          { targetReps: 10, targetWeight: 57.5, repRange: '8-10' }
        ]},
        { name: 'Incline Dumbbell Press', notes: 'Per hand', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 30, repRange: '6-8' },
          { targetReps: 8, targetWeight: 30, repRange: '6-8' }
        ]},
        { name: 'Pec Deck / Fly Machine', notes: 'Full stretch at open, squeeze hard at close. Controlled return.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 60, repRange: '10-12' },
          { targetReps: 12, targetWeight: 60, repRange: '10-12' },
          { targetReps: 15, targetWeight: 50, repRange: '12-15' }
        ]},
        { name: 'Chest Supported Dumbbell Row', notes: 'Drive elbows up, squeeze shoulder blades. Per hand.', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 35, repRange: '6-8' },
          { targetReps: 8, targetWeight: 35, repRange: '6-8' },
          { targetReps: 8, targetWeight: 35, repRange: '6-8' }
        ]},
        { name: 'Seated Shoulder Press Machine (Gymleco)', notes: '', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' }
        ]},
        { name: 'Cable Lateral Raise (cross body)', notes: '', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 15, repRange: '8-10' },
          { targetReps: 10, targetWeight: 15, repRange: '8-10' },
          { targetReps: 15, targetWeight: 10, repRange: '10-15' }
        ]},
        { name: 'Preacher Curl Machine', notes: 'Full extension at bottom, squeeze at top.', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 40, repRange: '8-12' },
          { targetReps: 10, targetWeight: 40, repRange: '8-12' }
        ]},
        { name: 'Cable Tricep Pushdown (straight bar)', notes: '', defaultRest: 90, sets: [
          { targetReps: 8, targetWeight: 65, repRange: '6-8' },
          { targetReps: 8, targetWeight: 65, repRange: '6-8' },
          { targetReps: 12, targetWeight: 50, repRange: '8-12' }
        ]}
      ]
    },
    {
      name: 'Lower A', day: 'Tuesday', subtitle: 'Quad/Glute Dominant', defaultRest: 150,
      exercises: [
        { name: 'Seated Hip Abduction', notes: 'Warm-up set, full ROM, controlled.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 105, repRange: '10-12' },
          { targetReps: 12, targetWeight: 105, repRange: '10-12' }
        ]},
        { name: 'Leg Press', notes: '', defaultRest: 180, sets: [
          { targetReps: 8, targetWeight: 200, repRange: '6-8' },
          { targetReps: 12, targetWeight: 170, repRange: '8-12' },
          { targetReps: 12, targetWeight: 170, repRange: '8-12' }
        ]},
        { name: 'Machine Hip Thrust', notes: 'Full hip extension at top, squeeze glutes.', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 102.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 102.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 102.5, repRange: '6-8' }
        ]},
        { name: 'Seated Knee Extension (tri-set)', notes: 'Bottom / Mid / Top positions', defaultRest: 120, sets: [
          { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' },
          { targetReps: 10, targetWeight: 40, repRange: '8-10', note: '40/20/25kg tri-set' }
        ]},
        { name: 'Romanian Deadlift', notes: 'Hinge at hips, bar close to body, flat back.', defaultRest: 180, sets: [
          { targetReps: 8, targetWeight: 107.5, repRange: '6-8' },
          { targetReps: 12, targetWeight: 100, repRange: '8-12' }
        ]},
        { name: 'Machine Crunch', notes: '', defaultRest: 60, sets: [
          { targetReps: 20, targetWeight: 97.5, repRange: '15-20' },
          { targetReps: 20, targetWeight: 97.5, repRange: '15-20' }
        ]},
        { name: '10 Minute Bike', notes: 'Cool down, moderate pace', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '10min' }
        ]}
      ]
    },
    {
      name: 'Upper B', day: 'Thursday', subtitle: 'Hypertrophy Volume', defaultRest: 150,
      exercises: [
        { name: 'Incline Chest Press Machine (plate loaded)', notes: '', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 40, repRange: '6-8' },
          { targetReps: 12, targetWeight: 32.5, repRange: '8-12' },
          { targetReps: 8, targetWeight: 40, repRange: '6-8' }
        ]},
        { name: 'Plate Loaded Lat Pulldown', notes: 'Mid/Top position', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 65, repRange: '6-8', note: '65kg mid / 40kg top' },
          { targetReps: 12, targetWeight: 50, repRange: '8-12', note: '50kg mid / 20kg top' },
          { targetReps: 8, targetWeight: 65, repRange: '6-8', note: '65kg mid / 40kg top' }
        ]},
        { name: 'Pec Deck / Fly Machine', notes: 'Higher rep pump set. Full ROM.', defaultRest: 90, sets: [
          { targetReps: 15, targetWeight: 55, repRange: '12-15' },
          { targetReps: 15, targetWeight: 55, repRange: '12-15' }
        ]},
        { name: 'Seated Row Machine (Pannatta)', notes: 'Chest supported, full stretch at extension.', defaultRest: 120, sets: [
          { targetReps: 12, targetWeight: 37.5, repRange: '8-12' },
          { targetReps: 12, targetWeight: 37.5, repRange: '8-12' },
          { targetReps: 12, targetWeight: 37.5, repRange: '8-12' }
        ]},
        { name: 'Lateral Raise Machine', notes: 'Full ROM, controlled return. No swinging.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 50, repRange: '10-12' },
          { targetReps: 12, targetWeight: 50, repRange: '10-12' },
          { targetReps: 15, targetWeight: 40, repRange: '12-15' }
        ]},
        { name: 'Rear Delt Row', notes: 'Use yoga block for ROM', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 47.5, repRange: '8-12' },
          { targetReps: 12, targetWeight: 47.5, repRange: '8-12' },
          { targetReps: 12, targetWeight: 47.5, repRange: '8-12' }
        ]},
        { name: 'Dumbbell Hammer Curl', notes: 'Per hand', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 20, repRange: '8-12' },
          { targetReps: 12, targetWeight: 20, repRange: '8-12' }
        ]},
        { name: 'Cable Tricep Pushdown (rope)', notes: '', defaultRest: 90, sets: [
          { targetReps: 15, targetWeight: 50, repRange: '10-15' },
          { targetReps: 15, targetWeight: 50, repRange: '10-15' },
          { targetReps: 15, targetWeight: 50, repRange: '10-15' }
        ]}
      ]
    },
    {
      name: 'Lower B', day: 'Friday', subtitle: 'Posterior Chain', defaultRest: 150,
      exercises: [
        { name: 'Laying Hamstring Curl', notes: '2 RIR, controlled descent.', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 62.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 62.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 62.5, repRange: '6-8' }
        ]},
        { name: '45 Degree Hyper Extension', notes: 'Hamstring focus, dumbbell', defaultRest: 120, sets: [
          { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
          { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
          { targetReps: 15, targetWeight: 7.5, repRange: '10-15' }
        ]},
        { name: 'Romanian Deadlift', notes: 'Hinge at hips, bar close to body, flat back.', defaultRest: 180, sets: [
          { targetReps: 8, targetWeight: 107.5, repRange: '6-8' },
          { targetReps: 12, targetWeight: 100, repRange: '8-12' }
        ]},
        { name: 'Machine Hip Thrust', notes: 'Higher rep version', defaultRest: 120, sets: [
          { targetReps: 12, targetWeight: 100, repRange: '8-12' },
          { targetReps: 12, targetWeight: 100, repRange: '8-12' }
        ]},
        { name: 'Leg Press (high foot placement)', notes: 'Feet high and wide, glute focus.', defaultRest: 120, sets: [
          { targetReps: 15, targetWeight: 150, repRange: '12-15' },
          { targetReps: 15, targetWeight: 150, repRange: '12-15' }
        ]},
        { name: 'Machine Crunch', notes: '', defaultRest: 60, sets: [
          { targetReps: 20, targetWeight: 95, repRange: '15-20' },
          { targetReps: 20, targetWeight: 95, repRange: '15-20' }
        ]},
        { name: '10 Minute Bike', notes: 'Cool down, moderate pace', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '10min' }
        ]}
      ]
    },
    {
      name: 'Upper C', day: 'Saturday', subtitle: 'Strength Upper + Arms', defaultRest: 150,
      exercises: [
        { name: 'Barbell Bench Press', notes: 'Heavier/lower rep strength focus.', defaultRest: 210, sets: [
          { targetReps: 6, targetWeight: 77.5, repRange: '4-6' },
          { targetReps: 6, targetWeight: 77.5, repRange: '4-6' },
          { targetReps: 6, targetWeight: 77.5, repRange: '4-6' }
        ]},
        { name: 'Chest Supported Dumbbell Row', notes: 'Heavy, per hand', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' }
        ]},
        { name: 'Lateral Raise Machine', notes: 'Full ROM, controlled return. No swinging.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 50, repRange: '10-12' },
          { targetReps: 12, targetWeight: 50, repRange: '10-12' },
          { targetReps: 15, targetWeight: 40, repRange: '12-15' }
        ]},
        { name: 'EZ Bar Bicep Curl', notes: 'Total bar weight, controlled descent.', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 32.5, repRange: '8-12' },
          { targetReps: 10, targetWeight: 32.5, repRange: '8-12' },
          { targetReps: 15, targetWeight: 25, repRange: '12-15' }
        ]},
        { name: 'Preacher Curl Machine', notes: 'Full extension at bottom, squeeze at top.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 40, repRange: '10-12' },
          { targetReps: 12, targetWeight: 40, repRange: '10-12' }
        ]},
        { name: 'Overhead Tricep Extension', notes: 'Cable or dumbbell', defaultRest: 90, sets: [
          { targetReps: 15, targetWeight: 22.5, repRange: '10-15' },
          { targetReps: 15, targetWeight: 22.5, repRange: '10-15' },
          { targetReps: 15, targetWeight: 22.5, repRange: '10-15' }
        ]},
        { name: 'Cable Tricep Pushdown (straight bar)', notes: '', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 50, repRange: '10-15' },
          { targetReps: 12, targetWeight: 50, repRange: '10-15' }
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
  if (!Store.get('rulecoach_programme')) {
    Store.set('rulecoach_programme', getDefaultProgramme());
  }
  // Migrate: reset programme if missing new exercises
  const _prog = Store.get('rulecoach_programme');
  if (_prog) {
    const _ua = _prog.find(w => w.name === 'Upper A');
    const needsReset = !_ua || !_ua.exercises.find(e => e.name === 'Lat Pulldown') || !_ua.exercises.find(e => e.name === 'Pec Deck / Fly Machine');
    if (needsReset) {
      Store.set('rulecoach_programme', getDefaultProgramme());
    }
  }
  if (!Store.get('rulecoach_sessions')) {
    Store.set('rulecoach_sessions', []);
  }
  if (!Store.get('rulecoach_settings')) {
    Store.set('rulecoach_settings', { apiKey: '', units: 'kg', userName: '' });
  }

  // Load settings into UI
  const settings = Store.get('rulecoach_settings');
  document.getElementById('settingName').value = settings.userName || '';
  document.getElementById('settingUnits').value = settings.units || 'kg';
  document.getElementById('settingApiKey').value = settings.apiKey || '';

  // Check for in-progress session
  const saved = Store.get('rulecoach_active_session');
  if (saved) {
    App.activeSession = saved.session;
    App.workoutStartTime = saved.startTime;
    App.activeSession._prevSession = App.today.getLastSessionData(App.activeSession.workoutName);
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
  const programme = Store.get('rulecoach_programme') || [];
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

  const settings = Store.get('rulecoach_settings') || {};
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
  const programme = Store.get('rulecoach_programme') || [];
  let html = '<h2>Choose Workout</h2>';
  programme.forEach(w => {
    html += `<button class="btn btn-outline btn-block" style="margin-top:10px" onclick="App.today.startWorkout('${w.name}');App.modal.forceClose();">${w.name} — ${w.subtitle}</button>`;
  });
  App.modal.open(html);
};

App.today.getLastSessionData = function(workoutName) {
  const sessions = Store.get('rulecoach_sessions') || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].workoutName === workoutName) return sessions[i];
  }
  return null;
};

App.today.startWorkout = function(name) {
  const programme = Store.get('rulecoach_programme') || [];
  const template = programme.find(w => w.name === name);
  if (!template) return;

  const prevSession = App.today.getLastSessionData(name);

  App.activeSession = {
    id: uuid(),
    date: new Date().toISOString(),
    workoutName: template.name,
    durationMinutes: 0,
    _prevSession: prevSession,
    exercises: template.exercises.map(ex => {
      const prevEx = prevSession ? prevSession.exercises.find(pe => pe.name === ex.name) : null;
      return {
        name: ex.name,
        notes: ex.notes || '',
        defaultRest: ex.defaultRest || template.defaultRest || 120,
        rpe: null,
        sets: ex.sets.map((s, si) => {
          const prevSet = prevEx && prevEx.sets[si] && prevEx.sets[si].status === 'done' ? prevEx.sets[si] : null;
          return {
            targetReps: s.targetReps,
            targetWeight: s.targetWeight,
            repRange: s.repRange || '',
            note: s.note || '',
            actualReps: prevSet ? prevSet.actualReps : s.targetReps,
            actualWeight: prevSet ? prevSet.actualWeight : s.targetWeight,
            status: null
          };
        })
      };
    })
  };
  App.workoutStartTime = Date.now();
  App.today.saveActive();
  App.today.renderActiveSession(document.getElementById('todayContent'));
  App.today.startElapsedTimer();
};

App.today.saveActive = function() {
  Store.set('rulecoach_active_session', {
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
  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = `
    <div class="workout-header">
      <div>
        <h2>${session.workoutName}</h2>
        <div style="font-size:13px;color:var(--text-dim);">${formatDate(session.date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="workout-timer-display" id="workoutElapsed">0:00</div>
        <button class="btn btn-cancel-workout" onclick="App.today.cancelWorkout()" title="Cancel workout">&#10005;</button>
      </div>
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

      const prevEx = session._prevSession
        ? session._prevSession.exercises.find(pe => pe.name === ex.name)
        : null;
      const prevSet = prevEx && prevEx.sets[si] && prevEx.sets[si].status === 'done'
        ? prevEx.sets[si] : null;
      const lastTimeHtml = prevSet
        ? `<div class="set-last-time">Last: ${prevSet.actualWeight}${unit} x ${prevSet.actualReps}</div>`
        : '';

      html += `
        <div class="${rowClass}" id="setRow${ei}_${si}">
          <div class="set-info">
            <div class="set-label">S${si + 1}</div>
            <div class="set-target">${targetLabel}</div>
            ${lastTimeHtml}
          </div>
          <div class="set-inputs">
            <input type="number" id="setW${ei}_${si}" value="${s.actualWeight}" step="0.5" inputmode="decimal"
              onchange="App.today.updateSet(${ei},${si},'weight',this.value)">
            <span class="unit-label">${unit}</span>
            <span class="unit-label">x</span>
            <input type="number" id="setR${ei}_${si}" value="${s.actualReps}" step="1" inputmode="numeric"
              onchange="App.today.updateSet(${ei},${si},'reps',this.value)">
            <span class="unit-label">reps</span>
          </div>
          <div class="set-actions">
            <button class="set-btn set-btn-done ${s.status === 'done' ? 'active' : ''}"
              onclick="App.today.markSet(${ei},${si},'done')">&#10003;</button>
            <button class="set-btn set-btn-skip ${s.status === 'skipped' ? 'active' : ''}"
              onclick="App.today.markSet(${ei},${si},'skipped')">S</button>
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

  const wasNull = s.status === null;

  // Toggle: if tapping the same status, undo it
  if (s.status === status) {
    s.status = null;
  } else {
    s.status = status;
  }
  App.today.saveActive();

  // Re-render the card area
  App.today.renderActiveSession(document.getElementById('todayContent'));

  // Auto-start rest timer only when transitioning from null to done/failed
  if (wasNull && (s.status === 'done' || s.status === 'failed')) {
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
  const sessions = Store.get('rulecoach_sessions') || [];
  sessions.push(session);
  Store.set('rulecoach_sessions', sessions);

  // Auto-progression
  const progressionChanges = App.today.applyAutoProgression(session);

  // Build summary
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.status === 'done').length, 0);
  const skippedSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.status === 'skipped').length, 0);
  const totalVolume = session.exercises.reduce((a, e) =>
    a + e.sets.filter(s => s.status === 'done').reduce((b, s) => b + (s.actualWeight * s.actualReps), 0)
  , 0);

  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  let progressionHtml = '';
  if (progressionChanges.length > 0) {
    progressionHtml = '<div class="progression-summary"><h3>Next Session</h3>';
    progressionChanges.forEach(c => {
      let icon, cls, detail;
      if (c.action === 'increase') {
        icon = '&#9650;'; cls = 'prog-increase';
        detail = `${c.from}${unit} → ${c.to}${unit}`;
      } else if (c.action === 'decrease') {
        icon = '&#9660;'; cls = 'prog-decrease';
        detail = `${c.from}${unit} → ${c.to}${unit}`;
      } else {
        icon = '&#9679;'; cls = 'prog-hold';
        detail = `${c.from}${unit} — hold`;
      }
      progressionHtml += `<div class="prog-item ${cls}">
        <span class="prog-icon">${icon}</span>
        <span class="prog-name">${c.exercise}</span>
        <span class="prog-detail">${detail}</span>
      </div>`;
      if (c.plateau) {
        progressionHtml += `<div class="prog-item prog-plateau">
          <span class="prog-icon">&#9888;</span>
          <span class="prog-name" style="font-size:11px;">Plateau: same weight for ${c.plateauCount} sessions</span>
        </div>`;
      }
    });
    progressionHtml += '<div class="prog-reason">' + progressionChanges.map(c => c.reason ? `${c.exercise}: ${c.reason}` : '').filter(Boolean).join('<br>') + '</div>';
    progressionHtml += '</div>';
  }

  const summaryHtml = `
    <h2>Workout Complete!</h2>
    <div style="margin:16px 0;">
      <div class="workout-complete-stat"><span class="stat-label">Workout</span><span class="stat-value">${session.workoutName}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Duration</span><span class="stat-value">${formatDuration(elapsed)}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Sets Completed</span><span class="stat-value">${doneSets}/${totalSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Skipped Sets</span><span class="stat-value">${skippedSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Total Volume</span><span class="stat-value">${Math.round(totalVolume).toLocaleString()} kg</span></div>
    </div>
    ${progressionHtml}
    <button class="btn btn-primary btn-block" onclick="App.modal.forceClose()">Done</button>`;

  App.modal.open(summaryHtml);

  // Clear active
  App.activeSession = null;
  App.workoutStartTime = null;
  localStorage.removeItem('rulecoach_active_session');
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  if (App.restTimer) { clearInterval(App.restTimer.interval); App.restTimer = null; }
  document.getElementById('finishFab').classList.remove('show');

  App.today.render();
};

App.today.applyAutoProgression = function(completedSession) {
  const programme = Store.get('rulecoach_programme') || [];
  const allSessions = Store.get('rulecoach_sessions') || [];
  const workout = programme.find(w => w.name === completedSession.workoutName);
  if (!workout) return [];

  // Get previous sessions for this workout (excluding the one just saved, which is the last)
  const prevSessions = [];
  for (let i = allSessions.length - 2; i >= 0; i--) {
    if (allSessions[i].workoutName === completedSession.workoutName) {
      prevSessions.push(allSessions[i]);
      if (prevSessions.length >= 3) break;
    }
  }

  const changes = [];
  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  completedSession.exercises.forEach(ex => {
    const templateEx = workout.exercises.find(e => e.name === ex.name);
    if (!templateEx) return;

    // Skip exercises with 0 weight (e.g. "10 Minute Bike")
    const mainWeight = templateEx.sets[0] ? templateEx.sets[0].targetWeight : 0;
    if (mainWeight === 0) return;

    const doneSets = ex.sets.filter(s => s.status === 'done');
    const totalSets = ex.sets.length;
    const attemptedSets = ex.sets.filter(s => s.status !== 'skipped' && s.status !== null);
    // If all sets skipped (machine in use etc), skip progression entirely
    if (doneSets.length === 0) return;
    const allDone = doneSets.length === totalSets;
    const allAttemptedDone = doneSets.length === attemptedSets.length && doneSets.length > 0;
    const hitAllReps = allAttemptedDone &&
      doneSets.every(s => s.actualReps >= s.targetReps);
    const avgRepMiss = doneSets.length > 0
      ? doneSets.reduce((sum, s) => sum + (s.targetReps - s.actualReps), 0) / doneSets.length
      : 0;
    const rpe = ex.rpe;
    const rpeOk = !rpe || rpe <= 8;

    // Check if weight increased in the most recent previous session (rate limiting)
    const prevEx1 = prevSessions[0] ? prevSessions[0].exercises.find(pe => pe.name === ex.name) : null;
    const prevEx2 = prevSessions[1] ? prevSessions[1].exercises.find(pe => pe.name === ex.name) : null;
    const recentlyIncreased = prevEx1 && prevEx2 &&
      prevEx1.sets[0] && prevEx2.sets[0] &&
      prevEx1.sets[0].actualWeight > prevEx2.sets[0].actualWeight;

    // Plateau detection: same weight for 3+ sessions
    let plateauCount = 0;
    if (prevSessions.length >= 2) {
      const currentWeight = ex.sets[0] ? ex.sets[0].actualWeight : 0;
      plateauCount = 1;
      for (const ps of prevSessions) {
        const pse = ps.exercises.find(pe => pe.name === ex.name);
        if (pse && pse.sets[0] && pse.sets[0].actualWeight === currentWeight) {
          plateauCount++;
        } else break;
      }
    }

    // Decision logic (skipped sets are ignored — machine may have been in use)
    if (avgRepMiss >= 3) {
      // DECREASE: reps well below target on completed sets
      const oldWeight = mainWeight;
      templateEx.sets.forEach(s => { s.targetWeight = Math.max(0, s.targetWeight - 2.5); });
      changes.push({ exercise: ex.name, action: 'decrease', from: oldWeight, to: oldWeight - 2.5, reason: `Reps well below target (avg ${Math.round(avgRepMiss)} short)` });
    } else if (hitAllReps && rpeOk && !recentlyIncreased) {
      // INCREASE: all sets hit, RPE manageable, not back-to-back increase
      const oldWeight = mainWeight;
      templateEx.sets.forEach(s => { s.targetWeight += 2.5; });
      let reason = 'All sets completed';
      if (rpe) reason += `, RPE ${rpe}`;
      changes.push({ exercise: ex.name, action: 'increase', from: oldWeight, to: oldWeight + 2.5, reason });
    } else if (hitAllReps && rpeOk && recentlyIncreased) {
      // HOLD: consolidating recent increase
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: 'Consolidating recent increase' });
    } else if (hitAllReps && !rpeOk) {
      // HOLD: RPE too high
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: `RPE ${rpe} — near max effort` });
    } else if (allDone && !hitAllReps) {
      // HOLD: completed but missed some reps
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: 'Completed but below target reps' });
    }

    // Add plateau warning
    if (plateauCount >= 3 && changes.length > 0) {
      const last = changes[changes.length - 1];
      if (last.exercise === ex.name) {
        last.plateau = true;
        last.plateauCount = plateauCount;
      }
    }
  });

  // Save updated programme
  Store.set('rulecoach_programme', programme);
  return changes;
};

App.today.cancelWorkout = function() {
  App.modal.open(`
    <h2>Cancel Workout?</h2>
    <p style="color:var(--text-dim);margin:12px 0;">This will discard all progress from this session. This cannot be undone.</p>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-outline" style="flex:1" onclick="App.modal.forceClose()">Keep Going</button>
      <button class="btn btn-danger btn-block" style="flex:1" onclick="App.today.confirmCancelWorkout()">Cancel Workout</button>
    </div>
  `);
};

App.today.confirmCancelWorkout = function() {
  App.activeSession = null;
  App.workoutStartTime = null;
  localStorage.removeItem('rulecoach_active_session');
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  if (App.restTimer) { clearInterval(App.restTimer.interval); App.restTimer = null; }
  document.getElementById('finishFab').classList.remove('show');
  App.modal.forceClose();
  App.today.render();
};

// ---- HISTORY SCREEN ----
App.history = {};

App.history.render = function() {
  const container = document.getElementById('historyContent');
  const sessions = (Store.get('rulecoach_sessions') || []).slice().reverse();

  if (sessions.length === 0) {
    container.innerHTML = '<div class="history-empty"><p>No sessions yet. Start your first workout!</p></div>';
    return;
  }

  const settings = Store.get('rulecoach_settings') || {};
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
  const sessions = Store.get('rulecoach_sessions') || [];
  const dataPoints = [];

  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      if (ex.name === exerciseName) {
        const doneSets = ex.sets.filter(set => set.status === 'done');
        const maxWeight = Math.max(...doneSets.map(set => set.actualWeight), 0);
        const totalVolume = doneSets.reduce((sum, set) => sum + set.actualWeight * set.actualReps, 0);
        if (maxWeight > 0) {
          dataPoints.push({ date: new Date(s.date), weight: maxWeight, volume: totalVolume });
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
    ctx.fillText(`${dataPoints[0].weight}${unit} | Vol: ${Math.round(dataPoints[0].volume)}`, W / 2, H / 2);
    return;
  }

  const padding = { top: 30, right: 55, bottom: 40, left: 50 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const weights = dataPoints.map(d => d.weight);
  const minW = Math.min(...weights) * 0.95;
  const maxW = Math.max(...weights) * 1.05;
  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  // Axes
  ctx.strokeStyle = '#2d2d44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, H - padding.bottom);
  ctx.lineTo(W - padding.right, H - padding.bottom);
  ctx.stroke();

  // Legend
  ctx.font = '11px system-ui';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7c3aed';
  ctx.fillText('\u25CF Max Weight', padding.left + 5, 16);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('\u25CF Total Volume', padding.left + 100, 16);

  // Y labels (weight - left axis)
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

  // Dots (weight)
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

  // Volume line + right axis
  const volumes = dataPoints.map(d => d.volume);
  const minV = Math.min(...volumes) * 0.9;
  const maxV = Math.max(...volumes) * 1.1;

  // Right Y-axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left';
  for (let i = 0; i <= ySteps; i++) {
    const val = minV + (maxV - minV) * (i / ySteps);
    const y = H - padding.bottom - (i / ySteps) * chartH;
    ctx.fillText(Math.round(val), W - padding.right + 8, y + 4);
  }

  // Volume line
  ctx.beginPath();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - ((d.volume - minV) / (maxV - minV)) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Volume dots
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - ((d.volume - minV) / (maxV - minV)) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
  });
};

App.chart.close = function() {
  document.getElementById('chartModal').classList.remove('show');
};

// ---- PROGRAMME SCREEN ----
App.programme = {};

App.programme.render = function() {
  const container = document.getElementById('programmeContent');
  const programme = Store.get('rulecoach_programme') || [];
  const settings = Store.get('rulecoach_settings') || {};
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
  const programme = Store.get('rulecoach_programme') || [];
  const w = programme[wi];
  const settings = Store.get('rulecoach_settings') || {};
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
  const programme = Store.get('rulecoach_programme') || [];
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

  Store.set('rulecoach_programme', programme);
  App.modal.forceClose();
  App.programme.render();
};

App.programme.reset = function() {
  if (confirm('Reset programme to defaults? This will overwrite your current programme.')) {
    Store.set('rulecoach_programme', getDefaultProgramme());
    App.programme.render();
  }
};

// ---- AI COACH ----
App.ai = {};

const AI_SYSTEM_PROMPT = `You are an expert strength and hypertrophy coach. The user trains 5 days per week on an Upper/Lower/Upper split, focusing on progressive overload for muscle gain and strength. They use a mix of barbells, dumbbells, cables and machines. Give specific, actionable recommendations with exact weights in kg. Be direct and concise.`;

App.ai.call = async function(userPrompt) {
  const settings = Store.get('rulecoach_settings') || {};
  if (!settings.apiKey) {
    App.ai.showError('Please add your Groq API key in Settings first. Get one free at console.groq.com/keys');
    return null;
  }

  document.getElementById('aiLoading').classList.add('show');
  document.getElementById('aiResponse').classList.remove('show');
  document.getElementById('aiError').classList.remove('show');

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || 'No response received.';

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
  const sessions = Store.get('rulecoach_sessions') || [];
  if (sessions.length === 0) {
    App.ai.showError('No sessions recorded yet. Complete a workout first.');
    return;
  }
  const last = sessions[sessions.length - 1];
  App.ai.call(`Analyse my last training session and give me a performance summary, what to push next time (specific weights), and recovery notes.\n\nSession data:\n${JSON.stringify(last, null, 2)}`);
};

App.ai.overload = function() {
  const sessions = Store.get('rulecoach_sessions') || [];
  if (sessions.length === 0) {
    App.ai.showError('No sessions recorded yet.');
    return;
  }
  const recent = sessions.slice(-20); // last ~4 weeks
  App.ai.call(`Based on my recent training sessions, give me per-exercise progressive overload recommendations. Flag any plateaus (same weight 3+ sessions). Suggest a deload if needed.\n\nRecent sessions:\n${JSON.stringify(recent, null, 2)}`);
};

App.ai.newBlock = function() {
  const sessions = Store.get('rulecoach_sessions') || [];
  const programme = Store.get('rulecoach_programme') || [];
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
  Store.set('rulecoach_settings', settings);

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
    programme: Store.get('rulecoach_programme'),
    sessions: Store.get('rulecoach_sessions'),
    settings: Store.get('rulecoach_settings'),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rulecoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

App.data.clearData = function() {
  if (confirm('This will permanently delete ALL your training data. Are you sure?')) {
    if (confirm('Really? This cannot be undone.')) {
      localStorage.removeItem('rulecoach_programme');
      localStorage.removeItem('rulecoach_sessions');
      localStorage.removeItem('rulecoach_active_session');
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
