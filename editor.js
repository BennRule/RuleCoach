/* ============================================================
   Rule Coach — Programme Editor
   Shares Firebase backend with the mobile PWA
   ============================================================ */

// ---- Firebase Setup (same config as main app) ----
const firebaseConfig = {
  apiKey: "AIzaSyDb1v-uOoovMPAUhEx89MT8xCw1BGbFYo4",
  authDomain: "rulecoach-c2fba.firebaseapp.com",
  projectId: "rulecoach-c2fba",
  storageBucket: "rulecoach-c2fba.firebasestorage.app",
  messagingSenderId: "953089761015",
  appId: "1:953089761015:web:cfa58c2018aac0442c3df2",
  measurementId: "G-9ZRJFGR1MY"
};

let db = null;
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
} catch (e) {
  console.warn('Firebase init failed:', e.message);
}

// ---- Editor State ----
const Editor = {
  programme: [],
  selectedIndex: -1,
  dirty: false,
  COLLECTION: 'rulecoach',
  get PROGRAMME_KEY() {
    const user = document.getElementById('userSelect')?.value || 'benn';
    return user === 'bonny' ? 'rulecoach_programme_bonny' : 'rulecoach_programme';
  },

  // ---- Init ----
  init() {
    document.getElementById('userSelect').addEventListener('change', () => {
      Editor.selectedIndex = -1;
      Editor.dirty = false;
      Editor.sessionCache = null; // Clear session cache on user switch
      Editor.sync();
    });
    // Auto-sync on load
    Editor.sync();
    // Init AI panel
    Editor.initAI();
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', e => {
      if (Editor.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  },

  // ---- Cloud Sync ----
  async sync() {
    // If there are unsaved edits, save them to cloud first before pulling
    if (Editor.dirty) {
      await Editor.save();
      return; // save() already syncs state
    }

    const ind = document.getElementById('syncIndicator');
    ind.textContent = 'Syncing...';
    ind.className = 'sync-indicator';

    if (!db) {
      ind.textContent = 'No Firebase';
      ind.className = 'sync-indicator error';
      // Fall back to localStorage
      const local = JSON.parse(localStorage.getItem(Editor.PROGRAMME_KEY) || 'null');
      if (local) {
        Editor.programme = local;
        Editor.renderSidebar();
        if (Editor.programme.length > 0) Editor.selectWorkout(0);
      }
      return;
    }

    try {
      const key = Editor.PROGRAMME_KEY;
      const doc = await db.collection(Editor.COLLECTION).doc(key).get();
      if (doc.exists && doc.data().data) {
        Editor.programme = doc.data().data;
      } else {
        // Try localStorage fallback
        const local = JSON.parse(localStorage.getItem(key) || 'null');
        if (local && local.length > 0) {
          Editor.programme = local;
        } else {
          Editor.programme = [];
        }
      }
      Editor.dirty = false;
      Editor.renderSidebar();
      if (Editor.programme.length > 0 && Editor.selectedIndex < 0) {
        Editor.selectWorkout(0);
      } else if (Editor.selectedIndex >= 0) {
        Editor.selectWorkout(Math.min(Editor.selectedIndex, Editor.programme.length - 1));
      }
      ind.textContent = 'Synced';
      ind.className = 'sync-indicator synced';
      setTimeout(() => {
        if (ind.textContent === 'Synced') {
          ind.textContent = new Date().toLocaleTimeString();
          ind.className = 'sync-indicator synced';
        }
      }, 2000);
    } catch (e) {
      ind.textContent = 'Sync error';
      ind.className = 'sync-indicator error';
      console.error('Sync failed:', e);
    }
  },

  async save() {
    // Commit current field values before saving
    Editor.commitCurrentWorkout();

    const ind = document.getElementById('syncIndicator');
    ind.textContent = 'Saving...';

    // Save to localStorage
    localStorage.setItem(Editor.PROGRAMME_KEY, JSON.stringify(Editor.programme));

    // Save to Firebase
    if (db) {
      try {
        await db.collection(Editor.COLLECTION).doc(Editor.PROGRAMME_KEY).set({
          data: Editor.programme,
          updatedAt: new Date().toISOString()
        });
        ind.textContent = 'Saved';
        ind.className = 'sync-indicator synced';
        Editor.dirty = false;
        Editor.updateSaveBtn();
      } catch (e) {
        ind.textContent = 'Save error';
        ind.className = 'sync-indicator error';
        console.error('Save failed:', e);
      }
    } else {
      ind.textContent = 'Saved locally';
      ind.className = 'sync-indicator synced';
      Editor.dirty = false;
      Editor.updateSaveBtn();
    }
  },

  markDirty() {
    Editor.dirty = true;
    Editor.updateSaveBtn();
  },

  updateSaveBtn() {
    const btn = document.getElementById('saveBtn');
    btn.textContent = Editor.dirty ? 'Save *' : 'Save';
  },

  // ---- Sidebar ----
  renderSidebar() {
    const list = document.getElementById('workoutList');
    list.innerHTML = '';
    Editor.programme.forEach((w, i) => {
      const div = document.createElement('div');
      div.className = 'workout-item' + (i === Editor.selectedIndex ? ' active' : '');
      div.draggable = true;
      div.dataset.index = i;
      div.innerHTML = `
        <div>${w.name}</div>
        <div class="workout-item-day">${w.day || ''} ${w.subtitle ? '— ' + w.subtitle : ''}</div>
      `;
      div.addEventListener('click', () => Editor.selectWorkout(i));
      // Drag-and-drop for reordering workouts
      div.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', i);
        e.dataTransfer.effectAllowed = 'move';
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
      div.addEventListener('drop', e => {
        e.preventDefault();
        div.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = i;
        if (fromIdx !== toIdx) {
          const [moved] = Editor.programme.splice(fromIdx, 1);
          Editor.programme.splice(toIdx, 0, moved);
          Editor.selectedIndex = toIdx;
          Editor.renderSidebar();
          Editor.markDirty();
        }
      });
      list.appendChild(div);
    });
  },

  // ---- Select Workout ----
  selectWorkout(idx) {
    // Commit current workout fields before switching
    if (Editor.selectedIndex >= 0 && Editor.selectedIndex !== idx) {
      Editor.commitCurrentWorkout();
    }

    Editor.selectedIndex = idx;
    Editor.renderSidebar();

    const workout = Editor.programme[idx];
    if (!workout) return;

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('workoutEditor').style.display = 'block';

    document.getElementById('workoutName').value = workout.name || '';
    document.getElementById('workoutSubtitle').value = workout.subtitle || '';
    document.getElementById('workoutDay').value = workout.day || 'Monday';
    document.getElementById('workoutRest').value = workout.defaultRest || 120;

    // Listen for header changes
    ['workoutName', 'workoutSubtitle', 'workoutDay', 'workoutRest'].forEach(id => {
      const el = document.getElementById(id);
      el.oninput = () => Editor.markDirty();
    });

    Editor.renderExercises();
  },

  commitCurrentWorkout() {
    const idx = Editor.selectedIndex;
    if (idx < 0 || !Editor.programme[idx]) return;
    const w = Editor.programme[idx];
    w.name = document.getElementById('workoutName').value.trim() || w.name;
    w.subtitle = document.getElementById('workoutSubtitle').value.trim();
    w.day = document.getElementById('workoutDay').value;
    w.defaultRest = parseInt(document.getElementById('workoutRest').value) || 120;

    // Commit exercise inline edits
    const rows = document.querySelectorAll('#exerciseBody tr[data-ex-index]');
    rows.forEach(row => {
      const ei = parseInt(row.dataset.exIndex);
      const ex = w.exercises[ei];
      if (!ex) return;
      const nameInput = row.querySelector('.input-name');
      const notesInput = row.querySelector('.input-notes');
      const restInput = row.querySelector('.input-rest');
      if (nameInput) ex.name = nameInput.value.trim() || ex.name;
      if (notesInput) ex.notes = notesInput.value.trim();
      if (restInput) ex.defaultRest = parseInt(restInput.value) || w.defaultRest;
    });
  },

  // ---- Exercise Table ----
  renderExercises() {
    const workout = Editor.programme[Editor.selectedIndex];
    if (!workout) return;

    const tbody = document.getElementById('exerciseBody');
    tbody.innerHTML = '';

    workout.exercises.forEach((ex, ei) => {
      const tr = document.createElement('tr');
      tr.dataset.exIndex = ei;
      tr.draggable = true;

      // Summarise sets
      const setsCount = ex.sets ? ex.sets.length : 0;
      const repRanges = ex.sets ? [...new Set(ex.sets.map(s => s.repRange || `${s.targetReps}`))].join(', ') : '-';
      const weights = ex.sets ? [...new Set(ex.sets.map(s => s.targetWeight))].map(w => w + 'kg').join(', ') : '-';

      tr.innerHTML = `
        <td class="col-drag"><span class="drag-handle">&#8801;</span></td>
        <td class="col-name"><input type="text" class="input-name" value="${escHtml(ex.name)}" /></td>
        <td class="col-notes"><input type="text" class="input-notes" value="${escHtml(ex.notes || '')}" placeholder="Notes..." /></td>
        <td class="col-sets" style="text-align:center;">
          <span>${setsCount}</span>
          <button class="btn-edit-sets" onclick="Editor.editSets(${ei})">Edit</button>
        </td>
        <td class="col-reps" style="text-align:center;">${repRanges}</td>
        <td class="col-weight" style="text-align:center;">${weights}</td>
        <td class="col-rest"><input type="number" class="input-rest" value="${ex.defaultRest || workout.defaultRest || 120}" style="width:60px;text-align:center;" /></td>
        <td class="col-actions"><button class="btn-remove-exercise" onclick="Editor.removeExercise(${ei})" title="Remove">&times;</button></td>
      `;

      // Make exercise name clickable for history
      const nameInput = tr.querySelector('.input-name');
      nameInput.classList.add('clickable-name');
      nameInput.addEventListener('click', (e) => {
        // Only trigger history on single click when not actively editing
        if (nameInput.dataset.editing) return;
        const name = nameInput.value.trim();
        if (name && name !== 'New Exercise') {
          Editor.showExerciseHistory(name);
        }
      });
      nameInput.addEventListener('dblclick', () => {
        nameInput.dataset.editing = 'true';
        nameInput.select();
      });
      nameInput.addEventListener('blur', () => {
        delete nameInput.dataset.editing;
      });

      // Inline change tracking
      tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => Editor.markDirty());
      });

      // Drag-and-drop for reordering exercises
      tr.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/exercise-index', ei);
        e.dataTransfer.effectAllowed = 'move';
        tr.classList.add('dragging');
      });
      tr.addEventListener('dragend', () => tr.classList.remove('dragging'));
      tr.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tr.classList.add('drag-over-row');
      });
      tr.addEventListener('dragleave', () => tr.classList.remove('drag-over-row'));
      tr.addEventListener('drop', e => {
        e.preventDefault();
        tr.classList.remove('drag-over-row');
        const fromStr = e.dataTransfer.getData('application/exercise-index');
        if (fromStr === '') return;
        const fromIdx = parseInt(fromStr);
        const toIdx = ei;
        if (fromIdx !== toIdx) {
          Editor.commitCurrentWorkout();
          const [moved] = workout.exercises.splice(fromIdx, 1);
          workout.exercises.splice(toIdx, 0, moved);
          Editor.markDirty();
          Editor.renderExercises();
        }
      });

      tbody.appendChild(tr);
    });
  },

  // ---- Add / Remove ----
  addWorkout() {
    Editor.commitCurrentWorkout();
    const name = prompt('Workout name (e.g. "Upper C"):');
    if (!name) return;
    Editor.programme.push({
      name: name.trim(),
      day: 'Monday',
      subtitle: '',
      defaultRest: 120,
      exercises: []
    });
    Editor.markDirty();
    Editor.renderSidebar();
    Editor.selectWorkout(Editor.programme.length - 1);
  },

  deleteWorkout() {
    const w = Editor.programme[Editor.selectedIndex];
    if (!w) return;
    if (!confirm(`Delete "${w.name}"? This cannot be undone.`)) return;
    Editor.programme.splice(Editor.selectedIndex, 1);
    Editor.selectedIndex = Math.min(Editor.selectedIndex, Editor.programme.length - 1);
    Editor.markDirty();
    Editor.renderSidebar();
    if (Editor.programme.length > 0) {
      Editor.selectWorkout(Editor.selectedIndex);
    } else {
      document.getElementById('workoutEditor').style.display = 'none';
      document.getElementById('emptyState').style.display = 'flex';
    }
  },

  addExercise() {
    Editor.commitCurrentWorkout();
    const workout = Editor.programme[Editor.selectedIndex];
    if (!workout) return;
    workout.exercises.push({
      name: 'New Exercise',
      notes: '',
      defaultRest: workout.defaultRest || 120,
      sets: [
        { targetReps: 10, targetWeight: 20, repRange: '8-12' },
        { targetReps: 10, targetWeight: 20, repRange: '8-12' },
        { targetReps: 10, targetWeight: 20, repRange: '8-12' }
      ]
    });
    Editor.markDirty();
    Editor.renderExercises();
    // Focus the new exercise name
    const rows = document.querySelectorAll('#exerciseBody tr');
    const lastRow = rows[rows.length - 1];
    if (lastRow) lastRow.querySelector('.input-name').focus();
  },

  removeExercise(ei) {
    const workout = Editor.programme[Editor.selectedIndex];
    if (!workout) return;
    const name = workout.exercises[ei]?.name || 'this exercise';
    if (!confirm(`Remove "${name}"?`)) return;
    Editor.commitCurrentWorkout();
    workout.exercises.splice(ei, 1);
    Editor.markDirty();
    Editor.renderExercises();
  },

  // ---- Set Editor Modal ----
  editSets(ei) {
    Editor.commitCurrentWorkout();
    const workout = Editor.programme[Editor.selectedIndex];
    const ex = workout?.exercises[ei];
    if (!ex) return;

    let html = `<h3>${escHtml(ex.name)} — Sets</h3>`;
    html += '<div id="setsContainer">';

    ex.sets.forEach((s, si) => {
      html += `
        <div class="set-editor-row" data-set="${si}">
          <span class="set-num">${si + 1}</span>
          <label>Reps</label>
          <input type="number" class="set-reps" value="${s.targetReps}" min="1" />
          <label>Range</label>
          <input type="text" class="set-range" value="${escHtml(s.repRange || '')}" placeholder="e.g. 8-12" style="width:60px;" />
          <label>Weight</label>
          <input type="number" class="set-weight" value="${s.targetWeight}" min="0" step="1.25" />
          <button class="btn-remove-exercise" onclick="Editor.removeSet(${ei}, ${si})" title="Remove set">&times;</button>
        </div>
      `;
    });

    html += '</div>';
    html += `
      <div class="modal-actions">
        <button class="btn" onclick="Editor.addSet(${ei})">+ Add Set</button>
        <button class="btn" onclick="Editor.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="Editor.saveSets(${ei})">Apply</button>
      </div>
    `;

    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  },

  addSet(ei) {
    const workout = Editor.programme[Editor.selectedIndex];
    const ex = workout?.exercises[ei];
    if (!ex) return;
    const lastSet = ex.sets[ex.sets.length - 1];
    ex.sets.push({
      targetReps: lastSet ? lastSet.targetReps : 10,
      targetWeight: lastSet ? lastSet.targetWeight : 20,
      repRange: lastSet ? lastSet.repRange : '8-12'
    });
    Editor.editSets(ei); // Re-render modal
  },

  removeSet(ei, si) {
    const workout = Editor.programme[Editor.selectedIndex];
    const ex = workout?.exercises[ei];
    if (!ex || ex.sets.length <= 1) return;
    ex.sets.splice(si, 1);
    Editor.editSets(ei); // Re-render modal
  },

  saveSets(ei) {
    const workout = Editor.programme[Editor.selectedIndex];
    const ex = workout?.exercises[ei];
    if (!ex) return;

    const rows = document.querySelectorAll('#setsContainer .set-editor-row');
    rows.forEach((row, si) => {
      if (!ex.sets[si]) return;
      ex.sets[si].targetReps = parseInt(row.querySelector('.set-reps').value) || 10;
      ex.sets[si].repRange = row.querySelector('.set-range').value.trim();
      ex.sets[si].targetWeight = parseFloat(row.querySelector('.set-weight').value) || 0;
    });

    Editor.markDirty();
    Editor.renderExercises();
    Editor.closeModal();
  },

  // ---- Modal ----
  closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modalOverlay').classList.remove('show');
  },

  // ============================================================
  // Right Panel — Toggle & Tabs
  // ============================================================
  rightPanelOpen: true,
  currentRightTab: 'history',
  sessionCache: null,
  selectedExerciseName: null,
  aiSuggestions: null,

  toggleRightPanel() {
    const panel = document.getElementById('rightPanel');
    const toggle = document.getElementById('rightPanelToggle');
    Editor.rightPanelOpen = !Editor.rightPanelOpen;
    if (Editor.rightPanelOpen) {
      panel.classList.remove('collapsed');
      toggle.classList.add('hidden');
      toggle.innerHTML = '&#9654;';
    } else {
      panel.classList.add('collapsed');
      toggle.classList.remove('hidden');
      toggle.innerHTML = '&#9664;';
    }
  },

  switchRightTab(tab) {
    Editor.currentRightTab = tab;
    document.querySelectorAll('.right-panel-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('tabHistory').style.display = tab === 'history' ? '' : 'none';
    document.getElementById('tabAI').style.display = tab === 'ai' ? '' : 'none';
  },

  // ============================================================
  // Exercise History
  // ============================================================
  get SESSIONS_KEY() {
    const user = document.getElementById('userSelect')?.value || 'benn';
    return `rulecoach_sessions_${user}`;
  },

  async loadSessions() {
    const key = Editor.SESSIONS_KEY;
    // Try Firebase first
    if (db) {
      try {
        const doc = await db.collection(Editor.COLLECTION).doc(key).get();
        if (doc.exists && doc.data().data) {
          Editor.sessionCache = doc.data().data;
          return;
        }
      } catch (e) {
        console.warn('Firebase session load failed, trying localStorage:', e.message);
      }
    }
    // localStorage fallback
    const local = localStorage.getItem(key);
    Editor.sessionCache = local ? JSON.parse(local) : [];
  },

  async showExerciseHistory(exerciseName) {
    Editor.selectedExerciseName = exerciseName;

    // Ensure right panel is open on history tab
    if (!Editor.rightPanelOpen) Editor.toggleRightPanel();
    Editor.switchRightTab('history');

    document.getElementById('historyEmpty').style.display = 'none';
    document.getElementById('historyContent').style.display = 'block';
    document.getElementById('historyExName').textContent = exerciseName;
    document.getElementById('historyStats').innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Loading...</span>';
    document.getElementById('historySessions').innerHTML = '';

    // Load sessions if not cached
    if (!Editor.sessionCache) {
      await Editor.loadSessions();
    }

    const sessions = Array.isArray(Editor.sessionCache) ? Editor.sessionCache : [];
    // Find sessions containing this exercise
    const matches = [];

    sessions.forEach((session, idx) => {
      if (!session || !session.exercises) return;

      session.exercises.forEach(ex => {
        if (!ex || !ex.name) return;
        if (ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase()) {
          matches.push({
            date: session.date || '',
            sessionIndex: idx,
            sessionId: session.id || idx,
            exercise: ex,
            workoutName: session.workoutName || ''
          });
        }
      });
    });

    // Sort by date descending, take last 10
    matches.sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      return db - da;
    });
    const last10 = matches.slice(0, 10);

    // Calculate stats
    let maxWeight = 0;
    let bestVolume = 0;
    let bestVolumeIdx = -1;

    last10.forEach((m, i) => {
      const sets = m.exercise.sets || [];
      let sessionVolume = 0;
      sets.forEach(s => {
        const w = parseFloat(s.actualWeight || s.weight) || 0;
        const r = parseInt(s.actualReps || s.reps) || 0;
        if (w > maxWeight) maxWeight = w;
        sessionVolume += w * r;
      });
      if (sessionVolume > bestVolume) {
        bestVolume = sessionVolume;
        bestVolumeIdx = i;
      }
    });

    // Render stats
    document.getElementById('historyStats').innerHTML = `
      <div class="history-stat">
        <div class="history-stat-label">Max Weight</div>
        <div class="history-stat-value best">${maxWeight > 0 ? maxWeight + 'kg' : '-'}</div>
      </div>
      <div class="history-stat">
        <div class="history-stat-label">Best Volume</div>
        <div class="history-stat-value best">${bestVolume > 0 ? bestVolume.toLocaleString() + 'kg' : '-'}</div>
      </div>
      <div class="history-stat">
        <div class="history-stat-label">Sessions</div>
        <div class="history-stat-value">${matches.length}</div>
      </div>
    `;

    // Render chart
    Editor.renderHistoryChart(last10.slice().reverse());

    // Render session cards
    const container = document.getElementById('historySessions');
    container.innerHTML = '';

    if (last10.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:16px 0;">No session history found for this exercise.</p>';
      return;
    }

    last10.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'history-session-card' + (i === bestVolumeIdx ? ' best-volume' : '');

      const dateStr = Editor.formatSessionDate(m.date);
      const sets = m.exercise.sets || [];
      const setsHtml = sets.map((s, si) => {
        const w = s.actualWeight || s.weight || s.targetWeight || '?';
        const r = s.actualReps || s.reps || s.targetReps || '?';
        return `Set ${si + 1}: ${w}kg x ${r}`;
      }).join('<br>');

      const rpeVal = sets.length > 0 ? sets[sets.length - 1].rpe : null;

      let badges = '';
      badges += `<span class="session-badge ${m.status}">${m.status}</span>`;
      if (i === bestVolumeIdx) badges += '<span class="session-badge best-vol">Best Volume</span>';
      // Check if this session has max weight
      const sessionMax = Math.max(0, ...sets.map(s => parseFloat(s.actualWeight || s.weight) || 0));
      if (sessionMax === maxWeight && maxWeight > 0) badges += '<span class="session-badge max-wt">Max Weight</span>';

      card.innerHTML = `
        <div class="session-date">${dateStr} ${badges}</div>
        <div class="session-sets">${setsHtml}</div>
        ${rpeVal ? `<div class="session-rpe">RPE: ${rpeVal}</div>` : ''}
        <button class="session-delete" onclick="Editor.deleteSessionExercise(${m.sessionIndex}, '${escHtml(m.exercise.name)}')" title="Delete this entry">&times;</button>
      `;

      container.appendChild(card);
    });
  },

  formatSessionDate(dateStr) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  renderHistoryChart(sessions) {
    const canvas = document.getElementById('historyChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth - 24;
    const h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (sessions.length < 2) {
      ctx.fillStyle = '#8888aa';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Need at least 2 sessions for chart', w / 2, h / 2);
      return;
    }

    // Data: max weight per session
    const points = sessions.map(m => {
      const sets = m.exercise.sets || [];
      return Math.max(0, ...sets.map(s => parseFloat(s.actualWeight || s.weight) || 0));
    });

    const minVal = Math.min(...points) * 0.9;
    const maxVal = Math.max(...points) * 1.05;
    const range = maxVal - minVal || 1;

    const padX = 40, padY = 20;
    const plotW = w - padX - 16;
    const plotH = h - padY * 2;

    // Grid lines
    ctx.strokeStyle = '#2a2a45';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - 16, y);
      ctx.stroke();

      // Labels
      const val = maxVal - (range / 4) * i;
      ctx.fillStyle = '#8888aa';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(0) + 'kg', padX - 6, y + 3);
    }

    // Line
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((val, i) => {
      const x = padX + (plotW / (points.length - 1)) * i;
      const y = padY + plotH - ((val - minVal) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    points.forEach((val, i) => {
      const x = padX + (plotW / (points.length - 1)) * i;
      const y = padY + plotH - ((val - minVal) / range) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  },

  async deleteSessionExercise(sessionIndex, exerciseName) {
    if (!confirm(`Delete "${exerciseName}" data from this session?`)) return;

    if (!Editor.sessionCache) await Editor.loadSessions();
    const sessions = Editor.sessionCache;
    if (!Array.isArray(sessions) || !sessions[sessionIndex]) return;

    const session = sessions[sessionIndex];
    if (!session.exercises) return;

    // Find and remove the exercise
    const idx = session.exercises.findIndex(ex => ex && ex.name && ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase());
    if (idx === -1) return;

    if (session.exercises.length <= 1) {
      // Remove the entire session
      sessions.splice(sessionIndex, 1);
    } else {
      session.exercises.splice(idx, 1);
    }

    // Save back
    const key = Editor.SESSIONS_KEY;
    localStorage.setItem(key, JSON.stringify(sessions));
    if (db) {
      try {
        await db.collection(Editor.COLLECTION).doc(key).set({
          data: sessions,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Failed to sync session deletion to Firebase:', e.message);
      }
    }

    // Refresh history view
    Editor.showExerciseHistory(exerciseName);
  },

  // ============================================================
  // AI Programme Evaluation
  // ============================================================
  initAI() {
    const savedKey = localStorage.getItem('rulecoach_editor_apikey');
    if (savedKey) {
      document.getElementById('aiApiKey').value = savedKey;
    }
    // Save key on change
    document.getElementById('aiApiKey').addEventListener('change', () => {
      localStorage.setItem('rulecoach_editor_apikey', document.getElementById('aiApiKey').value.trim());
    });
  },

  async aiEvaluate() {
    const apiKey = document.getElementById('aiApiKey').value.trim();
    if (!apiKey) {
      alert('Please enter your Anthropic API key.');
      return;
    }
    localStorage.setItem('rulecoach_editor_apikey', apiKey);

    const goal = document.getElementById('aiGoal').value;
    const btn = document.getElementById('aiEvalBtn');
    const responseEl = document.getElementById('aiResponse');
    const applyWrap = document.getElementById('aiApplyWrap');

    btn.disabled = true;
    btn.textContent = 'Evaluating...';
    applyWrap.style.display = 'none';
    Editor.aiSuggestions = null;
    responseEl.innerHTML = '<div class="ai-loading"><div class="ai-loading-spinner"></div><br>Analysing your programme...</div>';

    // Build context: programme + recent history
    Editor.commitCurrentWorkout();
    if (!Editor.sessionCache) await Editor.loadSessions();

    const programmeJson = JSON.stringify(Editor.programme, null, 2);
    const sessionsJson = Editor.sessionCache ? JSON.stringify(Editor.sessionCache, null, 2).slice(0, 12000) : '{}';

    const goalLabels = { hypertrophy: 'Hypertrophy (muscle growth)', strength: 'Strength (1RM improvement)', strength_hypertrophy: 'Strength + Hypertrophy (heavy compounds + hypertrophy volume)', general: 'General Fitness', fatloss: 'Fat Loss' };
    const goalLabel = goalLabels[goal] || goal;

    const systemPrompt = `You are an expert strength & conditioning coach reviewing a workout programme. The user's goal is: ${goalLabel}.

Analyse the programme and recent session history. Provide:
1. An overall programme assessment (2-3 sentences)
2. Per-exercise recommendations — for each exercise, note if volume/intensity should change, if exercise swaps would help, or if rep ranges need adjusting
3. Suggested modifications

After your text analysis, output a JSON block (fenced with \`\`\`json) containing structured suggestions that can be programmatically applied. Use this exact schema:
\`\`\`json
{
  "suggestions": [
    {
      "workoutIndex": 0,
      "exerciseIndex": 0,
      "action": "modify",
      "changes": {
        "sets": [{"targetReps": 10, "targetWeight": 30, "repRange": "8-12"}],
        "notes": "optional note"
      }
    },
    {
      "workoutIndex": 0,
      "exerciseIndex": -1,
      "action": "add",
      "exercise": {
        "name": "New Exercise",
        "notes": "",
        "defaultRest": 120,
        "sets": [{"targetReps": 10, "targetWeight": 20, "repRange": "8-12"}]
      }
    },
    {
      "workoutIndex": 0,
      "exerciseIndex": 2,
      "action": "remove"
    }
  ]
}
\`\`\`
Actions: "modify" (update sets/notes), "add" (insert new exercise, exerciseIndex=-1 for end), "remove" (delete exercise).
Only suggest changes that meaningfully improve the programme for the stated goal.`;

    const userMessage = `Here is my current workout programme:\n\n${programmeJson}\n\nHere are my recent session logs (truncated):\n\n${sessionsJson}\n\nPlease evaluate this programme for the goal: ${goalLabel}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API error ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || 'No response received.';

      // Parse out JSON suggestions if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            Editor.aiSuggestions = parsed.suggestions;
            applyWrap.style.display = '';
          }
        } catch (e) {
          console.warn('Failed to parse AI suggestions JSON:', e.message);
        }
      }

      // Render response — convert markdown-ish text to HTML
      const htmlContent = Editor.renderAIResponse(text);
      responseEl.innerHTML = `<div class="ai-response-content">${htmlContent}</div>`;

    } catch (e) {
      responseEl.innerHTML = `<div class="ai-response-empty" style="color:var(--danger);">Error: ${escHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Evaluate Programme';
    }
  },

  renderAIResponse(text) {
    // Strip the JSON block from display
    let clean = text.replace(/```json\s*[\s\S]*?```/g, '');
    // Basic markdown to HTML
    clean = escHtml(clean);
    // Headers
    clean = clean.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    clean = clean.replace(/^## (.+)$/gm, '<h4>$1</h4>');
    clean = clean.replace(/^# (.+)$/gm, '<h4>$1</h4>');
    // Bold
    clean = clean.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Bullet lists
    clean = clean.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
    clean = clean.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Numbered lists
    clean = clean.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Paragraphs (double newlines)
    clean = clean.replace(/\n\n/g, '</p><p>');
    clean = '<p>' + clean + '</p>';
    // Clean up empty paragraphs
    clean = clean.replace(/<p>\s*<\/p>/g, '');
    return clean;
  },

  aiApplySuggestions() {
    if (!Editor.aiSuggestions || !Array.isArray(Editor.aiSuggestions)) return;
    const count = Editor.aiSuggestions.length;
    if (!confirm(`Apply ${count} AI suggestion${count !== 1 ? 's' : ''} to your programme? This will modify exercises. You can undo by not saving.`)) return;

    Editor.commitCurrentWorkout();

    // Apply suggestions in reverse order for removes (to keep indices valid)
    const sorted = [...Editor.aiSuggestions].sort((a, b) => {
      // Removes last (highest index first), adds last
      if (a.action === 'remove' && b.action !== 'remove') return 1;
      if (b.action === 'remove' && a.action !== 'remove') return -1;
      if (a.action === 'remove' && b.action === 'remove') return (b.exerciseIndex || 0) - (a.exerciseIndex || 0);
      return 0;
    });

    let applied = 0;
    sorted.forEach(s => {
      const workout = Editor.programme[s.workoutIndex];
      if (!workout) return;

      if (s.action === 'modify' && s.changes) {
        const ex = workout.exercises[s.exerciseIndex];
        if (!ex) return;
        if (s.changes.sets) ex.sets = s.changes.sets;
        if (s.changes.notes !== undefined) ex.notes = s.changes.notes;
        if (s.changes.name) ex.name = s.changes.name;
        if (s.changes.defaultRest) ex.defaultRest = s.changes.defaultRest;
        applied++;
      } else if (s.action === 'add' && s.exercise) {
        if (s.exerciseIndex >= 0 && s.exerciseIndex < workout.exercises.length) {
          workout.exercises.splice(s.exerciseIndex, 0, s.exercise);
        } else {
          workout.exercises.push(s.exercise);
        }
        applied++;
      } else if (s.action === 'remove') {
        if (s.exerciseIndex >= 0 && s.exerciseIndex < workout.exercises.length) {
          workout.exercises.splice(s.exerciseIndex, 1);
          applied++;
        }
      }
    });

    Editor.markDirty();
    Editor.renderExercises();
    Editor.renderSidebar();

    // Update AI response area
    const applyWrap = document.getElementById('aiApplyWrap');
    applyWrap.innerHTML = `<p style="color:var(--success);font-size:13px;text-align:center;">Applied ${applied} suggestion${applied !== 1 ? 's' : ''}. Review changes and Save when ready.</p>`;
  },
};

// ---- Utility ----
function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    Editor.save();
  }
});

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => Editor.init());
