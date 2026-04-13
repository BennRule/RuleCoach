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
  PROGRAMME_KEY: 'rulecoach_programme',

  // ---- Init ----
  init() {
    document.getElementById('userSelect').addEventListener('change', () => Editor.sync());
    // Auto-sync on load
    Editor.sync();
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
      const doc = await db.collection(Editor.COLLECTION).doc(Editor.PROGRAMME_KEY).get();
      if (doc.exists && doc.data().data) {
        Editor.programme = doc.data().data;
      } else {
        // Try localStorage fallback
        const local = JSON.parse(localStorage.getItem(Editor.PROGRAMME_KEY) || 'null');
        if (local) Editor.programme = local;
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
