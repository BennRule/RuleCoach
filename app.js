/* ============================================================
   Rule Coach — Personal Training Tracker PWA
   ============================================================ */

// ---- Service Worker Registration (force update) ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.update());
  });
  navigator.serviceWorker.register('sw.js?v=5').catch(() => {});
  // Force activate new SW immediately
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}

// ---- Offline detection ----
function updateOnlineStatus() {
  document.getElementById('offlineBanner').classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', () => {
  updateOnlineStatus();
  // Push/pull anything that changed while offline
  if (typeof Sync !== 'undefined' && db) Sync.pullAll().catch(() => {});
});
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

// Escape text for safe interpolation into innerHTML
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape a value for use inside a '...'-quoted JS string within an HTML attribute
function escJs(str) {
  return esc(String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

// ---- Firebase Setup ----
// TODO: Replace with your Firebase project config from console.firebase.google.com
// Steps: Create project → Firestore Database → Create (europe-west2, test mode)
//        → Project Settings → Your apps → Add web app → Copy config
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

// ---- Storage ----
const Store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    if (typeof Sync !== 'undefined') Sync.debouncePush(key);
  },
};

// ---- Cloud Sync ----
const Sync = {
  COLLECTION: 'rulecoach',
  SYNC_KEYS: [
    'rulecoach_programme',
    'rulecoach_programme_bonny',
    'rulecoach_sessions_benn',
    'rulecoach_sessions_bonny',
    'rulecoach_settings',
    'rulecoach_bodyweight',
    'rulecoach_bonny_week',
    'rulecoach_active_session'
  ],
  TS_KEY: '_rulecoach_sync_timestamps',
  _debounceTimers: {},
  _status: 'idle',
  _lastSyncTime: null,

  getTimestamps() {
    try { return JSON.parse(localStorage.getItem(Sync.TS_KEY)) || {}; } catch { return {}; }
  },

  setTimestamp(key, time) {
    const ts = Sync.getTimestamps();
    ts[key] = time;
    localStorage.setItem(Sync.TS_KEY, JSON.stringify(ts));
  },

  async pushKey(key) {
    if (!db) return;
    try {
      let val = Store.get(key);
      const now = new Date().toISOString();

      // SAFETY: For session/bodyweight keys (append-only data), merge with remote by ID
      // to prevent accidental data loss when an old client pushes a stale local copy.
      const isSessionKey = key.startsWith('rulecoach_sessions_') || key === 'rulecoach_bodyweight';
      if (isSessionKey && Array.isArray(val)) {
        try {
          const remoteDoc = await db.collection(Sync.COLLECTION).doc(key).get();
          if (remoteDoc.exists && Array.isArray(remoteDoc.data().data)) {
            const remoteArr = remoteDoc.data().data;
            const localIds = new Set(val.map((s, i) => s && s.id ? s.id : 'idx-' + i));
            const onlyInRemote = remoteArr.filter((s, i) => {
              const id = s && s.id ? s.id : 'remote-idx-' + i;
              return !localIds.has(id);
            });
            if (onlyInRemote.length > 0) {
              // Merge: union of local + remote-only items
              val = [...val, ...onlyInRemote];
              val.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
              // Update local copy too
              localStorage.setItem(key, JSON.stringify(val));
            }
          }
        } catch (mergeErr) {
          console.warn('Merge check failed for', key, mergeErr.message);
        }
      }

      await db.collection(Sync.COLLECTION).doc(key).set({
        data: val,
        updatedAt: now
      });
      Sync.setTimestamp(key, now);
    } catch (e) {
      console.warn('Sync push failed:', key, e.message);
    }
  },

  debouncePush(key) {
    if (!db || !Sync.SYNC_KEYS.includes(key)) return;
    Sync.setTimestamp(key, new Date().toISOString());
    clearTimeout(Sync._debounceTimers[key]);
    Sync._debounceTimers[key] = setTimeout(() => Sync.pushKey(key), 2000);
  },

  async pullAll() {
    if (!db) { Sync.renderStatus('No Firebase config'); return; }
    Sync._status = 'syncing';
    Sync.renderStatus('Syncing...');
    try {
      const localTs = Sync.getTimestamps();
      for (const key of Sync.SYNC_KEYS) {
        const doc = await db.collection(Sync.COLLECTION).doc(key).get();
        if (doc.exists) {
          const remote = doc.data();
          const remoteTime = remote.updatedAt || '1970-01-01';
          const localTime = localTs[key] || '1970-01-01';
          if (remoteTime > localTime) {
            // Remote is newer — overwrite local (bypass Store.set to avoid re-sync loop)
            localStorage.setItem(key, JSON.stringify(remote.data));
            Sync.setTimestamp(key, remoteTime);
          } else if (localTime > remoteTime) {
            // Local is newer — push to remote, BUT never overwrite remote data with empty/null
            const local = Store.get(key);
            const remoteData = remote.data;
            const localIsEmpty = local === null || (Array.isArray(local) && local.length === 0);
            const remoteHasData = remoteData !== null && !(Array.isArray(remoteData) && remoteData.length === 0);
            if (localIsEmpty && remoteHasData) {
              // Safety: don't wipe remote data — pull remote instead
              localStorage.setItem(key, JSON.stringify(remoteData));
              Sync.setTimestamp(key, remoteTime);
            } else {
              await Sync.pushKey(key);
            }
          }
        } else {
          // No remote doc — push local if we have data (but not empty arrays)
          const local = Store.get(key);
          const localHasData = local !== null && !(Array.isArray(local) && local.length === 0);
          if (localHasData) await Sync.pushKey(key);
        }
      }
      Sync._status = 'idle';
      Sync._lastSyncTime = new Date();
      Sync.renderStatus();
    } catch (e) {
      Sync._status = 'error';
      Sync.renderStatus('Sync error: ' + e.message);
    }
  },

  async forceSync() {
    await Sync.pullAll();
    // Re-render all screens with potentially updated data
    if (typeof App !== 'undefined' && App.init) {
      App.init();
    }
  },

  renderStatus(msg) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.className = Sync._status === 'error' ? 'sync-status-error' : '';
      return;
    }
    if (Sync._lastSyncTime) {
      const ago = Math.round((Date.now() - Sync._lastSyncTime.getTime()) / 1000);
      const agoStr = ago < 60 ? 'just now' : ago < 3600 ? Math.floor(ago / 60) + ' min ago' : Math.floor(ago / 3600) + 'h ago';
      el.textContent = 'Last synced: ' + agoStr;
      el.className = 'sync-status-ok';
    } else {
      el.textContent = 'Not synced yet';
      el.className = '';
    }
  }
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
        { name: 'Cable Seated Row (narrow grip)', notes: 'Full stretch at extension, squeeze at peak contraction.', defaultRest: 120, sets: [
          { targetReps: 10, targetWeight: 50, repRange: '8-12' },
          { targetReps: 10, targetWeight: 50, repRange: '8-12' },
          { targetReps: 10, targetWeight: 50, repRange: '8-12' }
        ]},
        { name: 'Seated Shoulder Press Machine (Gymleco)', notes: '', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' },
          { targetReps: 8, targetWeight: 37.5, repRange: '6-8' }
        ]},
        { name: 'Rear Delt Row', notes: 'Use yoga block for ROM. Light, controlled.', defaultRest: 90, sets: [
          { targetReps: 12, targetWeight: 45, repRange: '10-12' },
          { targetReps: 12, targetWeight: 45, repRange: '10-12' },
          { targetReps: 12, targetWeight: 45, repRange: '10-12' }
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
          { targetReps: 10, targetWeight: 85, repRange: '8-10', note: '40/20/25kg tri-set' },
          { targetReps: 10, targetWeight: 85, repRange: '8-10', note: '40/20/25kg tri-set' }
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
          { targetReps: 8, targetWeight: 40, repRange: '6-8' },
          { targetReps: 12, targetWeight: 32.5, repRange: '10-12', note: 'Back-off set' }
        ]},
        { name: 'Plate Loaded Lat Pulldown', notes: 'Mid/Top position', defaultRest: 150, sets: [
          { targetReps: 8, targetWeight: 105, repRange: '6-8', note: '65kg mid / 40kg top' },
          { targetReps: 12, targetWeight: 70, repRange: '8-12', note: '50kg mid / 20kg top' },
          { targetReps: 8, targetWeight: 105, repRange: '6-8', note: '65kg mid / 40kg top' }
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
        { name: 'Seated Shoulder Press Machine (Gymleco)', notes: 'Hypertrophy rep range, controlled descent.', defaultRest: 120, sets: [
          { targetReps: 10, targetWeight: 32.5, repRange: '8-12' },
          { targetReps: 10, targetWeight: 32.5, repRange: '8-12' },
          { targetReps: 10, targetWeight: 32.5, repRange: '8-12' }
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
        { name: 'Hack Squat or Smith Machine Squat', notes: 'Quad focus, feet shoulder width. Full depth.', defaultRest: 150, sets: [
          { targetReps: 10, targetWeight: 80, repRange: '8-12' },
          { targetReps: 10, targetWeight: 80, repRange: '8-12' },
          { targetReps: 10, targetWeight: 80, repRange: '8-12' }
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
      name: 'Upper C', day: 'Saturday', subtitle: 'Arms + Shoulders', defaultRest: 150,
      exercises: [
        { name: 'Pec Deck / Fly Machine', notes: 'Stretch focus, full ROM. Arms day opener.', defaultRest: 90, sets: [
          { targetReps: 15, targetWeight: 55, repRange: '12-15' },
          { targetReps: 15, targetWeight: 55, repRange: '12-15' },
          { targetReps: 15, targetWeight: 55, repRange: '12-15' }
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

function getDefaultBonnyProgramme() {
  return [
    {
      name: 'Full Body 1', day: 'Monday', subtitle: 'Strength + Upper', defaultRest: 60,
      exercises: [
        { name: '5 Minute Treadmill Warmup', notes: 'Brisk walk to warm up.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '5min' }
        ]},
        { name: 'Seated Hip Abduction', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 27.5, repRange: '12-15' },
          { targetReps: 12, targetWeight: 27.5, repRange: '12-15' },
          { targetReps: 12, targetWeight: 27.5, repRange: '12-15' }
        ]},
        { name: 'Leg Press', notes: 'Per side', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
          { targetReps: 10, targetWeight: 17.5, repRange: '8-10' },
          { targetReps: 10, targetWeight: 17.5, repRange: '8-10' }
        ]},
        { name: 'Seated Hamstring Curl', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 32, repRange: '8-12' },
          { targetReps: 12, targetWeight: 32, repRange: '8-12' },
          { targetReps: 12, targetWeight: 32, repRange: '8-12' }
        ]},
        { name: 'Chest Supported Machine Row', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 20, repRange: '10-15' },
          { targetReps: 12, targetWeight: 20, repRange: '10-15' },
          { targetReps: 12, targetWeight: 20, repRange: '10-15' }
        ]},
        { name: 'Rear Fly Machine', notes: '', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 20, repRange: '8-12' },
          { targetReps: 10, targetWeight: 20, repRange: '8-12' },
          { targetReps: 10, targetWeight: 20, repRange: '8-12' }
        ]},
        { name: 'Standing Bicep Curl on Cable Machine', notes: 'Superset with tricep extensions — as little rest as possible between the two.', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 15, repRange: '10-15' },
          { targetReps: 12, targetWeight: 15, repRange: '10-15' },
          { targetReps: 12, targetWeight: 15, repRange: '10-15' }
        ]},
        { name: 'Standing Cable Tricep Extension', notes: 'Superset with bicep curls.', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 20, repRange: '10-15' },
          { targetReps: 12, targetWeight: 20, repRange: '10-15' },
          { targetReps: 12, targetWeight: 20, repRange: '10-15' }
        ]}
      ]
    },
    {
      name: 'Full Body 2', day: 'Wednesday', subtitle: 'Glute + Shoulder Focus', defaultRest: 60,
      exercises: [
        { name: '5 Minute Treadmill Warmup', notes: 'Brisk walk to warm up.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '5min' }
        ]},
        { name: 'Seated Hip Adduction', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 25, repRange: '12-15' },
          { targetReps: 12, targetWeight: 25, repRange: '12-15' },
          { targetReps: 12, targetWeight: 25, repRange: '12-15' }
        ]},
        { name: 'Machine Hip Thrust', notes: 'Per side', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 20, repRange: '8-10' },
          { targetReps: 10, targetWeight: 20, repRange: '8-10' },
          { targetReps: 10, targetWeight: 20, repRange: '8-10' }
        ]},
        { name: 'Seated Knee Extension', notes: '', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 21, repRange: '8-12' },
          { targetReps: 10, targetWeight: 21, repRange: '8-12' },
          { targetReps: 10, targetWeight: 21, repRange: '8-12' }
        ]},
        { name: 'Neutral Grip Lat Pulldown', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 30, repRange: '10-15' },
          { targetReps: 12, targetWeight: 30, repRange: '10-15' },
          { targetReps: 12, targetWeight: 30, repRange: '10-15' }
        ]},
        { name: 'Neutral Grip Seated Dumbbell Shoulder Press', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 5, repRange: '10-15' },
          { targetReps: 12, targetWeight: 5, repRange: '10-15' },
          { targetReps: 12, targetWeight: 5, repRange: '10-15' }
        ]},
        { name: 'Dumbbell Lateral Raise', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 2.5, repRange: '10-15' },
          { targetReps: 12, targetWeight: 2.5, repRange: '10-15' },
          { targetReps: 12, targetWeight: 2.5, repRange: '10-15' }
        ]}
      ]
    },
    {
      name: 'Full Body 3', day: 'Monday', subtitle: 'Posterior + Press', defaultRest: 60,
      exercises: [
        { name: '5 Minute Treadmill Warmup', notes: 'Brisk walk to warm up.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '5min' }
        ]},
        { name: 'Romanian Deadlift', notes: 'Per side (20kg total)', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 20, repRange: '8-10' },
          { targetReps: 10, targetWeight: 20, repRange: '8-10' }
        ]},
        { name: 'Goblet Squat', notes: '12.5kg dumbbell', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 12.5, repRange: '8-10' },
          { targetReps: 10, targetWeight: 12.5, repRange: '8-10' }
        ]},
        { name: 'Glute Kickback Machine', notes: 'Per side', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 20, repRange: '8-12' },
          { targetReps: 12, targetWeight: 20, repRange: '8-12' }
        ]},
        { name: 'Seated Chest Press', notes: '', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 5, repRange: '8-12' },
          { targetReps: 10, targetWeight: 5, repRange: '8-12' }
        ]},
        { name: 'Cable Cross Body Lateral Raise', notes: 'Lowest weight setting', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 5, repRange: '8-12' },
          { targetReps: 10, targetWeight: 5, repRange: '8-12' }
        ]},
        { name: 'Cable Pallof Press', notes: 'Slower than the video! Per side.', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 10, repRange: '10-15' },
          { targetReps: 12, targetWeight: 10, repRange: '10-15' }
        ]}
      ]
    },
    {
      name: 'Full Body 4', day: 'Wednesday', subtitle: 'Pull + Core', defaultRest: 60,
      exercises: [
        { name: '5 Minute Treadmill Warmup', notes: 'Brisk walk to warm up.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '5min' }
        ]},
        { name: 'Seated Hip Abduction', notes: '', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 35, repRange: '8-10' },
          { targetReps: 10, targetWeight: 35, repRange: '8-10' },
          { targetReps: 10, targetWeight: 35, repRange: '8-10' }
        ]},
        { name: 'Cable Pull Through', notes: '', defaultRest: 90, sets: [
          { targetReps: 10, targetWeight: 30, repRange: '8-10' },
          { targetReps: 10, targetWeight: 30, repRange: '8-10' },
          { targetReps: 10, targetWeight: 30, repRange: '8-10' }
        ]},
        { name: 'Laying Hamstring Curl', notes: '', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 20, repRange: '8-12' },
          { targetReps: 10, targetWeight: 20, repRange: '8-12' },
          { targetReps: 10, targetWeight: 20, repRange: '8-12' }
        ]},
        { name: 'Single Arm Lat Pulldown Machine', notes: 'Per side', defaultRest: 60, sets: [
          { targetReps: 10, targetWeight: 30, repRange: '8-12' },
          { targetReps: 10, targetWeight: 30, repRange: '8-12' }
        ]},
        { name: 'Machine Tricep Dip', notes: '', defaultRest: 60, sets: [
          { targetReps: 12, targetWeight: 25, repRange: '10-15' },
          { targetReps: 12, targetWeight: 25, repRange: '10-15' }
        ]},
        { name: 'Table Top Crunch', notes: '', defaultRest: 60, sets: [
          { targetReps: 18, targetWeight: 0, repRange: '15-20' },
          { targetReps: 18, targetWeight: 0, repRange: '15-20' }
        ]}
      ]
    },
    {
      name: 'Cardio', day: 'Sunday', subtitle: 'Conditioning', defaultRest: 30,
      exercises: [
        { name: '10 Minute Fast Walk', notes: '', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '10min' }
        ]},
        { name: 'Row (Intervals)', notes: '30 seconds work at 7/10 effort, 30 seconds complete rest. 6-10 rounds.', defaultRest: 30, sets: [
          { targetReps: 8, targetWeight: 0, repRange: '6-10 rounds' }
        ]},
        { name: 'Bike Erg', notes: '2000m — record your time.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '2000m' }
        ]},
        { name: '10-20 Minute Walk', notes: 'Cool down.', defaultRest: 0, sets: [
          { targetReps: 1, targetWeight: 0, repRange: '10-20min' }
        ]}
      ]
    }
  ];
}

function getBonnyProgramme() {
  return Store.get('rulecoach_programme_bonny') || getDefaultBonnyProgramme();
}

function getBonnyWeek() {
  return Store.get('rulecoach_bonny_week') || 'A';
}

function getBonnyTodayWorkout() {
  const dow = new Date().getDay();
  const week = getBonnyWeek();
  if (dow === 0) return 'Cardio';
  if (dow === 1) return week === 'A' ? 'Full Body 1' : 'Full Body 3';
  if (dow === 3) return week === 'A' ? 'Full Body 2' : 'Full Body 4';
  return null;
}

function sessionsKey() {
  const settings = Store.get('rulecoach_settings') || {};
  return 'rulecoach_sessions_' + (settings.user || 'benn');
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
  // Seed defaults locally WITHOUT triggering a sync push. A fresh device must
  // never push its seeded defaults over the cloud copy — Sync.pullAll() fetches
  // the real data, and only pushes local data if no remote doc exists at all.
  const seed = (key, val) => {
    if (!Store.get(key)) localStorage.setItem(key, JSON.stringify(val));
  };
  seed('rulecoach_programme', getDefaultProgramme());
  seed('rulecoach_programme_bonny', getDefaultBonnyProgramme());
  // Migrate sessions from old key to user-specific key
  try {
    const oldRaw = localStorage.getItem('rulecoach_sessions');
    const oldSessions = oldRaw ? JSON.parse(oldRaw) : null;
    if (oldSessions && Array.isArray(oldSessions) && oldSessions.length > 0) {
      const currentBenn = Store.get('rulecoach_sessions_benn') || [];
      if (currentBenn.length === 0) {
        Store.set('rulecoach_sessions_benn', oldSessions);
        console.log('Migrated ' + oldSessions.length + ' sessions from old key to rulecoach_sessions_benn');
      } else {
        // Merge: add any from old key that aren't already in new key (by id)
        const existingIds = new Set(currentBenn.map(s => s.id));
        const toAdd = oldSessions.filter(s => !existingIds.has(s.id));
        if (toAdd.length > 0) {
          Store.set('rulecoach_sessions_benn', [...currentBenn, ...toAdd]);
          console.log('Merged ' + toAdd.length + ' sessions from old key');
        }
      }
    }
  } catch(e) { console.warn('Session migration error:', e); }
  seed(sessionsKey(), []);
  seed('rulecoach_settings', { apiKey: '', units: 'kg', userName: '' });

  // Load settings into UI
  const settings = Store.get('rulecoach_settings');
  document.getElementById('settingUnits').value = settings.units || 'kg';

  // Check for in-progress session. A session that already exists in history is a
  // stale leftover (e.g. finished on another device) — clear it instead of resuming.
  const saved = Store.get('rulecoach_active_session');
  if (saved && saved.session) {
    const priorSessions = Store.get(sessionsKey()) || [];
    const alreadyFinished = priorSessions.some(s => s.id === saved.session.id);
    if (alreadyFinished) {
      Store.set('rulecoach_active_session', { session: null, startTime: null });
    } else {
      App.activeSession = saved.session;
      App.workoutStartTime = saved.startTime;
      App.activeSession._prevSession = App.today.getLastSessionData(App.activeSession.workoutName);
    }
  }

  // RuleCoach: hardcoded to benn (Bonny has separate BonnyCoach app).
  // Local-only hygiene — write directly so it never pushes over cloud settings.
  if (settings.user !== 'benn') {
    settings.user = 'benn';
    localStorage.setItem('rulecoach_settings', JSON.stringify(settings));
  }
  App.settings.updateUserButtons();

  App.today.render();
  App.history.render();
  App.programme.render();
  App.bodyweight.render();

  // Cloud sync: pull from Firestore (non-blocking)
  if (db && navigator.onLine) {
    Sync.pullAll().then(() => {
      // Adopt an in-progress session synced from another device — only if idle here,
      // not already finished (saved to history), and recent enough to plausibly be live
      if (!App.activeSession) {
        const pulled = Store.get('rulecoach_active_session');
        if (pulled && pulled.session) {
          const sessions = Store.get(sessionsKey()) || [];
          const alreadyFinished = sessions.some(s => s.id === pulled.session.id);
          const ageHours = (Date.now() - new Date(pulled.session.date).getTime()) / 3600000;
          if (!alreadyFinished && ageHours < 12) {
            App.activeSession = pulled.session;
            App.workoutStartTime = pulled.startTime;
            App.activeSession._prevSession = App.today.getLastSessionData(App.activeSession.workoutName);
            App.today.startElapsedTimer();
          }
        }
      }
      // Refresh settings UI in case settings were pulled
      const pulledSettings = Store.get('rulecoach_settings') || {};
      document.getElementById('settingUnits').value = pulledSettings.units || 'kg';
      App.today.render();
      App.history.render();
      App.programme.render();
      App.bodyweight.render();
    }).catch(() => {});
  }
};

// ---- Navigation ----
App.nav = function(screen) {
  App.currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));

  if (screen === 'history') App.history.render();
  if (screen === 'programme') App.programme.render();
  if (screen === 'settings') Sync.renderStatus();
};

// ---- TODAY SCREEN ----
App.today = {};

App.today.getTodayWorkout = function() {
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  if (user === 'bonny') {
    const name = getBonnyTodayWorkout();
    if (!name) return null;
    return getBonnyProgramme().find(w => w.name === name) || null;
  }
  // Rotation, not weekday: the next workout is whichever follows the most
  // recently completed one in programme order, so a short week still cycles
  // through every session (legs included) rather than dropping Friday's.
  const programme = Store.get('rulecoach_programme') || [];
  if (!programme.length) return null;
  const sessions = Store.get(sessionsKey()) || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const idx = programme.findIndex(w => w.name === sessions[i].workoutName);
    if (idx >= 0) return programme[(idx + 1) % programme.length];
  }
  return programme[0];
};

// Days since this workout was last completed, or null if never
App.today.daysSinceWorkout = function(workoutName) {
  const sessions = Store.get(sessionsKey()) || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].workoutName === workoutName) {
      return Math.floor((Date.now() - new Date(sessions[i].date).getTime()) / 86400000);
    }
  }
  return null;
};

App.today.render = function() {
  const container = document.getElementById('todayContent');
  const workout = App.today.getTodayWorkout();

  if (App.activeSession) {
    App.today.renderActiveSession(container);
    App.today.showRestBar();
    App.today.resetRestBar();
    return;
  }

  // No active session — hide rest bar
  App.today.hideRestBar();

  if (!workout) {
    container.innerHTML = `
      <div class="rest-day-msg">
        <h2>No programme</h2>
        <p>Set up a programme on the Programme tab, or sync from the cloud in Settings.</p>
        <button class="btn btn-outline" style="margin-top:24px" onclick="App.nav('settings')">Go to Settings</button>
      </div>`;
    document.getElementById('finishFab').classList.remove('show');
    return;
  }

  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const greeting = `Hey ${user.charAt(0).toUpperCase() + user.slice(1)}`;
  const since = App.today.daysSinceWorkout(workout.name);
  const lastDone = since === null ? 'Not done yet' : since === 0 ? 'Last done today' : since === 1 ? 'Last done yesterday' : `Last done ${since} days ago`;

  container.innerHTML = `
    <h1 class="screen-title">${greeting}</h1>
    <div class="card">
      <div style="font-size:11px;font-weight:700;color:var(--accent-light);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Next in rotation</div>
      <h2 style="font-size:20px;font-weight:700;">${esc(workout.name)}</h2>
      <p style="font-size:14px;color:var(--text-dim);margin-top:2px;">${esc(workout.subtitle)}</p>
      <p style="font-size:13px;color:var(--text-dim);margin-top:4px;">${workout.exercises.length} exercises · ${lastDone}</p>
      <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="App.today.startWorkout('${escJs(workout.name)}')">
        Start Workout
      </button>
    </div>
    <button class="btn btn-outline btn-block" onclick="App.today.startAnyWorkout()">Choose a different workout</button>`;
  document.getElementById('finishFab').classList.remove('show');
};

App.today.startAnyWorkout = function() {
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const programme = user === 'bonny' ? getBonnyProgramme() : (Store.get('rulecoach_programme') || []);
  let html = '<h2>Choose Workout</h2>';
  programme.forEach(w => {
    html += `<button class="btn btn-outline btn-block" style="margin-top:10px" onclick="App.today.startWorkout('${escJs(w.name)}');App.modal.forceClose();">${esc(w.name)} — ${esc(w.subtitle)}</button>`;
  });
  App.modal.open(html);
};

App.today.getLastSessionData = function(workoutName) {
  const sessions = Store.get(sessionsKey()) || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].workoutName === workoutName) return sessions[i];
  }
  return null;
};

App.today.startWorkout = function(name) {
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const programme = user === 'bonny' ? getBonnyProgramme() : (Store.get('rulecoach_programme') || []);
  const template = programme.find(w => w.name === name);
  if (!template) return;

  const prevSession = App.today.getLastSessionData(name);
  const allSessions = Store.get(sessionsKey()) || [];
  // After 3+ weeks away from this workout, last actuals are no longer a safe
  // starting point — start from the programme's targets instead.
  const layoff = !!prevSession && (Date.now() - new Date(prevSession.date).getTime()) > 21 * 86400000;

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
        hold: !!ex.hold,
        holdReason: ex.holdReason || '',
        rpe: null,
        sets: ex.sets.map((s, si) => {
          const prevSet = prevEx && prevEx.sets[si] && prevEx.sets[si].status === 'done' ? prevEx.sets[si] : null;
          // Auto-progression writes new target weights into the programme template.
          // Trust the template only when it differs from last actuals by at most one
          // progression increment (a deliberate increase/decrease). A bigger gap means
          // the template is stale — carry last session's actuals instead so targets
          // never slip backwards.
          const inc = App.today.getIncrement(ex.name, allSessions);
          // Allow up to two steps so a ramp-back increase is honoured
          const templateMoved = prevSet && prevSet.actualWeight !== s.targetWeight &&
            Math.abs(s.targetWeight - prevSet.actualWeight) <= inc * 2 + 0.01;
          // A held exercise always starts at the programme's fixed weight
          const useTemplate = s.targetWeight > 0 && (!prevSet || templateMoved || layoff || ex.hold);
          const startReps = useTemplate || !prevSet ? s.targetReps : prevSet.actualReps;
          const startWeight = useTemplate || !prevSet ? s.targetWeight : prevSet.actualWeight;
          return {
            targetReps: startReps,
            targetWeight: startWeight,
            repRange: s.repRange || '',
            note: s.note || '',
            actualReps: startReps,
            actualWeight: startWeight,
            status: null
          };
        })
      };
    })
  };
  App.workoutStartTime = Date.now();
  App._lastRestTime = 120; // Default 2 min for warmup taps
  App.today.saveActive();
  App.today.renderActiveSession(document.getElementById('todayContent'));
  App.today.startElapsedTimer();
  App.today.showRestBar();
  App.today.resetRestBar();
};

App.today.saveActive = function() {
  Store.set('rulecoach_active_session', {
    session: App.activeSession,
    startTime: App.workoutStartTime
  });
};

App.today.saveNotes = function(value) {
  if (!App.activeSession) return;
  App.activeSession.notes = value;
  App.today.saveActive();
};

// ---- Exercise Categories ----
const EXERCISE_DB = {
  // Chest — Push (horizontal)
  'Barbell Bench Press':                      { muscle: 'Chest', pattern: 'Push', equipment: 'Barbell' },
  'Incline Dumbbell Press':                   { muscle: 'Chest', pattern: 'Push', equipment: 'Dumbbell' },
  'Incline Chest Press Machine (plate loaded)':{ muscle: 'Chest', pattern: 'Push', equipment: 'Machine' },
  'Pec Deck / Fly Machine':                   { muscle: 'Chest', pattern: 'Push', equipment: 'Machine' },
  'Seated Chest Press':                       { muscle: 'Chest', pattern: 'Push', equipment: 'Machine' },
  'Dumbbell Bench Press':                     { muscle: 'Chest', pattern: 'Push', equipment: 'Dumbbell' },
  'Cable Chest Fly':                          { muscle: 'Chest', pattern: 'Push', equipment: 'Cable' },
  'Dips (chest focus)':                       { muscle: 'Chest', pattern: 'Push', equipment: 'Bodyweight' },
  'Push Ups':                                 { muscle: 'Chest', pattern: 'Push', equipment: 'Bodyweight' },

  // Back — Pull (vertical)
  'Lat Pulldown':                             { muscle: 'Back', pattern: 'Pull', equipment: 'Cable' },
  'Plate Loaded Lat Pulldown':                { muscle: 'Back', pattern: 'Pull', equipment: 'Machine' },
  'Neutral Grip Lat Pulldown':                { muscle: 'Back', pattern: 'Pull', equipment: 'Cable' },
  'Single Arm Lat Pulldown Machine':          { muscle: 'Back', pattern: 'Pull', equipment: 'Machine' },
  'Pull Ups':                                 { muscle: 'Back', pattern: 'Pull', equipment: 'Bodyweight' },
  'Chin Ups':                                 { muscle: 'Back', pattern: 'Pull', equipment: 'Bodyweight' },

  // Back — Pull (horizontal)
  'Chest Supported Dumbbell Row':             { muscle: 'Back', pattern: 'Row', equipment: 'Dumbbell' },
  'Cable Seated Row (narrow grip)':           { muscle: 'Back', pattern: 'Row', equipment: 'Cable' },
  'Seated Row Machine (Pannatta)':            { muscle: 'Back', pattern: 'Row', equipment: 'Machine' },
  'Chest Supported Machine Row':              { muscle: 'Back', pattern: 'Row', equipment: 'Machine' },
  'Barbell Bent Over Row':                    { muscle: 'Back', pattern: 'Row', equipment: 'Barbell' },
  'Dumbbell Single Arm Row':                  { muscle: 'Back', pattern: 'Row', equipment: 'Dumbbell' },
  'T-Bar Row':                                { muscle: 'Back', pattern: 'Row', equipment: 'Barbell' },

  // Shoulders — Press
  'Seated Shoulder Press Machine (Gymleco)':  { muscle: 'Shoulders', pattern: 'Push', equipment: 'Machine' },
  'Neutral Grip Seated Dumbbell Shoulder Press': { muscle: 'Shoulders', pattern: 'Push', equipment: 'Dumbbell' },
  'Barbell Overhead Press':                   { muscle: 'Shoulders', pattern: 'Push', equipment: 'Barbell' },
  'Dumbbell Shoulder Press':                  { muscle: 'Shoulders', pattern: 'Push', equipment: 'Dumbbell' },
  'Arnold Press':                             { muscle: 'Shoulders', pattern: 'Push', equipment: 'Dumbbell' },

  // Shoulders — Lateral
  'Cable Lateral Raise (cross body)':         { muscle: 'Shoulders', pattern: 'Lateral', equipment: 'Cable' },
  'Lateral Raise Machine':                    { muscle: 'Shoulders', pattern: 'Lateral', equipment: 'Machine' },
  'Dumbbell Lateral Raise':                   { muscle: 'Shoulders', pattern: 'Lateral', equipment: 'Dumbbell' },
  'Cable Cross Body Lateral Raise':           { muscle: 'Shoulders', pattern: 'Lateral', equipment: 'Cable' },

  // Shoulders — Rear delt
  'Rear Delt Row':                            { muscle: 'Rear Delts', pattern: 'Pull', equipment: 'Dumbbell' },
  'Rear Fly Machine':                         { muscle: 'Rear Delts', pattern: 'Pull', equipment: 'Machine' },
  'Face Pulls':                               { muscle: 'Rear Delts', pattern: 'Pull', equipment: 'Cable' },
  'Band Pull Aparts':                         { muscle: 'Rear Delts', pattern: 'Pull', equipment: 'Band' },

  // Biceps
  'Preacher Curl Machine':                    { muscle: 'Biceps', pattern: 'Curl', equipment: 'Machine' },
  'EZ Bar Bicep Curl':                        { muscle: 'Biceps', pattern: 'Curl', equipment: 'Barbell' },
  'Dumbbell Hammer Curl':                     { muscle: 'Biceps', pattern: 'Curl', equipment: 'Dumbbell' },
  'Standing Bicep Curl on Cable Machine':     { muscle: 'Biceps', pattern: 'Curl', equipment: 'Cable' },
  'Incline Dumbbell Curl':                    { muscle: 'Biceps', pattern: 'Curl', equipment: 'Dumbbell' },
  'Barbell Curl':                             { muscle: 'Biceps', pattern: 'Curl', equipment: 'Barbell' },
  'Concentration Curl':                       { muscle: 'Biceps', pattern: 'Curl', equipment: 'Dumbbell' },

  // Triceps
  'Cable Tricep Pushdown (straight bar)':     { muscle: 'Triceps', pattern: 'Extension', equipment: 'Cable' },
  'Cable Tricep Pushdown (rope)':             { muscle: 'Triceps', pattern: 'Extension', equipment: 'Cable' },
  'Overhead Tricep Extension':                { muscle: 'Triceps', pattern: 'Extension', equipment: 'Cable' },
  'Standing Cable Tricep Extension':          { muscle: 'Triceps', pattern: 'Extension', equipment: 'Cable' },
  'Machine Tricep Dip':                       { muscle: 'Triceps', pattern: 'Extension', equipment: 'Machine' },
  'Skull Crushers':                           { muscle: 'Triceps', pattern: 'Extension', equipment: 'Barbell' },
  'Close Grip Bench Press':                   { muscle: 'Triceps', pattern: 'Extension', equipment: 'Barbell' },

  // Quads
  'Leg Press':                                { muscle: 'Quads', pattern: 'Press', equipment: 'Machine' },
  'Leg Press (high foot placement)':          { muscle: 'Quads', pattern: 'Press', equipment: 'Machine' },
  'Hack Squat or Smith Machine Squat':        { muscle: 'Quads', pattern: 'Squat', equipment: 'Machine' },
  'Seated Knee Extension (tri-set)':          { muscle: 'Quads', pattern: 'Extension', equipment: 'Machine' },
  'Seated Knee Extension':                    { muscle: 'Quads', pattern: 'Extension', equipment: 'Machine' },
  'Goblet Squat':                             { muscle: 'Quads', pattern: 'Squat', equipment: 'Dumbbell' },
  'Barbell Back Squat':                       { muscle: 'Quads', pattern: 'Squat', equipment: 'Barbell' },
  'Front Squat':                              { muscle: 'Quads', pattern: 'Squat', equipment: 'Barbell' },
  'Bulgarian Split Squat':                    { muscle: 'Quads', pattern: 'Squat', equipment: 'Dumbbell' },
  'Walking Lunges':                           { muscle: 'Quads', pattern: 'Squat', equipment: 'Dumbbell' },

  // Glutes
  'Machine Hip Thrust':                       { muscle: 'Glutes', pattern: 'Hip Hinge', equipment: 'Machine' },
  'Seated Hip Abduction':                     { muscle: 'Glutes', pattern: 'Abduction', equipment: 'Machine' },
  'Seated Hip Adduction':                     { muscle: 'Glutes', pattern: 'Adduction', equipment: 'Machine' },
  'Glute Kickback Machine':                   { muscle: 'Glutes', pattern: 'Hip Hinge', equipment: 'Machine' },
  'Cable Pull Through':                       { muscle: 'Glutes', pattern: 'Hip Hinge', equipment: 'Cable' },
  'Barbell Hip Thrust':                       { muscle: 'Glutes', pattern: 'Hip Hinge', equipment: 'Barbell' },
  'Glute Bridge':                             { muscle: 'Glutes', pattern: 'Hip Hinge', equipment: 'Bodyweight' },

  // Hamstrings
  'Romanian Deadlift':                        { muscle: 'Hamstrings', pattern: 'Hip Hinge', equipment: 'Barbell' },
  'Laying Hamstring Curl':                    { muscle: 'Hamstrings', pattern: 'Curl', equipment: 'Machine' },
  'Seated Hamstring Curl':                    { muscle: 'Hamstrings', pattern: 'Curl', equipment: 'Machine' },
  '45 Degree Hyper Extension':                { muscle: 'Hamstrings', pattern: 'Hip Hinge', equipment: 'Bodyweight' },
  'Good Mornings':                            { muscle: 'Hamstrings', pattern: 'Hip Hinge', equipment: 'Barbell' },
  'Nordic Hamstring Curl':                    { muscle: 'Hamstrings', pattern: 'Curl', equipment: 'Bodyweight' },

  // Core
  'Machine Crunch':                           { muscle: 'Core', pattern: 'Flexion', equipment: 'Machine' },
  'Cable Pallof Press':                       { muscle: 'Core', pattern: 'Anti-Rotation', equipment: 'Cable' },
  'Table Top Crunch':                         { muscle: 'Core', pattern: 'Flexion', equipment: 'Bodyweight' },
  'Hanging Leg Raise':                        { muscle: 'Core', pattern: 'Flexion', equipment: 'Bodyweight' },
  'Ab Wheel Rollout':                         { muscle: 'Core', pattern: 'Anti-Extension', equipment: 'Other' },
  'Plank':                                    { muscle: 'Core', pattern: 'Anti-Extension', equipment: 'Bodyweight' },

  // Cardio
  '10 Minute Bike':                           { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
  '20 Minute Bike':                           { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
  '15 Minute Incline Walk':                   { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
  '5 Minute Treadmill Warmup':                { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
  'Treadmill':                                { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
  'Rowing Machine':                           { muscle: 'Cardio', pattern: 'Cardio', equipment: 'Machine' },
};

function getExerciseCategory(name) {
  return EXERCISE_DB[name] || null;
}

App.today.swapExercise = function(ei) {
  const current = App.activeSession.exercises[ei].name;
  const cat = getExerciseCategory(current);

  // Gather all known exercises (from DB + programme)
  const programme = Store.get('rulecoach_programme') || [];
  const progNames = [...new Set(programme.flatMap(w => w.exercises.map(e => e.name)))];
  const allNames = [...new Set([...Object.keys(EXERCISE_DB), ...progNames])];

  // Categorise: same muscle, same pattern, then everything else
  let sameMusclePattern = [];
  let sameMuscle = [];
  let others = [];

  allNames.filter(n => n !== current).forEach(name => {
    const c = getExerciseCategory(name);
    if (cat && c && c.muscle === cat.muscle && c.pattern === cat.pattern) {
      sameMusclePattern.push(name);
    } else if (cat && c && c.muscle === cat.muscle) {
      sameMuscle.push(name);
    } else {
      others.push(name);
    }
  });

  sameMusclePattern.sort();
  sameMuscle.sort();
  others.sort();

  let html = `<h2>Swap: ${esc(current)}</h2>`;
  if (cat) html += `<p style="color:var(--text-dim);font-size:13px;margin-bottom:4px;">${cat.muscle} · ${cat.pattern} · ${cat.equipment}</p>`;
  html += `<p style="color:var(--text-dim);font-size:12px;margin-bottom:16px;">Session only — won't change your programme</p>`;

  function makeBtn(name, badge) {
    const c = getExerciseCategory(name);
    const sub = c ? `<span style="font-size:11px;color:var(--text-dim);margin-left:8px;">${c.equipment}</span>` : '';
    return `<button class="btn btn-outline btn-block" style="margin-top:5px;text-align:left;padding:10px 12px;" onclick="App.today._confirmSwap(${ei},'${escJs(name)}');App.modal.forceClose();">${badge ? `<span style="display:inline-block;background:var(--accent);color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;margin-right:6px;">${badge}</span>` : ''}${esc(name)}${sub}</button>`;
  }

  if (sameMusclePattern.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--accent);margin:12px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Best match — same muscle &amp; movement</div>`;
    sameMusclePattern.forEach(n => html += makeBtn(n, '★'));
  }
  if (sameMuscle.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin:16px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Same muscle group</div>`;
    sameMuscle.forEach(n => html += makeBtn(n));
  }
  if (others.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin:16px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">All other exercises</div>`;
    others.forEach(n => html += makeBtn(n));
  }

  App.modal.open(html);
};

App.today._confirmSwap = function(ei, newName) {
  if (!App.activeSession) return;
  const oldEx = App.activeSession.exercises[ei];

  // Try to find last session where user did this exercise — use those weights/reps
  const sessions = Store.get(sessionsKey()) || [];
  let foundSets = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const prev = sessions[i].exercises.find(e => e.name === newName);
    if (prev && prev.sets && prev.sets.length > 0) {
      foundSets = prev.sets.map(s => ({
        targetReps: s.actualReps || s.targetReps,
        targetWeight: s.actualWeight != null ? s.actualWeight : s.targetWeight,
        repRange: s.repRange || oldEx.sets[0]?.repRange || '8-12',
        actualReps: null,
        actualWeight: s.actualWeight != null ? s.actualWeight : s.targetWeight,
        status: null
      }));
      break;
    }
  }

  // If not found in history, check programme defaults
  if (!foundSets) {
    const programme = Store.get('rulecoach_programme') || [];
    const allProgrammes = [...programme, ...(typeof getBonnyProgramme === 'function' ? getBonnyProgramme() : [])];
    for (const w of allProgrammes) {
      const progEx = w.exercises.find(e => e.name === newName);
      if (progEx && progEx.sets) {
        foundSets = progEx.sets.map(s => ({
          targetReps: s.targetReps,
          targetWeight: s.targetWeight,
          repRange: s.repRange || '8-12',
          actualReps: null,
          actualWeight: s.targetWeight,
          status: null
        }));
        break;
      }
    }
  }

  // Apply: swap name and sets (keep same number of sets if no match found)
  oldEx.name = newName;
  if (foundSets) {
    oldEx.sets = foundSets;
  } else {
    // No history or programme data — reset weights to 0 so user enters fresh
    oldEx.sets.forEach(s => {
      s.targetWeight = 0;
      s.actualWeight = 0;
      s.actualReps = null;
      s.status = null;
    });
  }

  App.today.saveActive();
  App.today.renderActiveSession(document.getElementById('todayContent'));
};

// Video ID lookup for exercise demos
const EXERCISE_INFO = {
  'Barbell Bench Press': { video: 'iBdF89xBAxA', desc: 'Barbell Bench Press begins lying flat on a bench with feet flat on the floor, gripping the barbell slightly wider than shoulder width. Unrack the bar and lower it under control to the mid-chest, keeping elbows at roughly 45 degrees. Pause briefly at the chest, then press the bar back up to full lockout, driving through the chest and triceps.' },
  'Lat Pulldown': { video: '_edsRrSFlOg', desc: 'Lat Pulldown begins seated at the pulldown machine with thighs secured under the pads, gripping the bar slightly wider than shoulder width. Initiate the movement by driving the elbows down and back, pulling the bar to the upper chest. Squeeze the lats at the bottom, then return the bar under control to full arm extension, feeling the stretch through the lats.' },
  'Incline Dumbbell Press': { video: 'nvqJUDs9EXQ', desc: 'Incline Dumbbell Bench Press begins seated and lying back on an incline bench, with knees bent and heels on the floor, and a dumbbell in either hand, held just outside of the chest, with elbows bent and hands pronated. Extend the dumbbells up and in, ending with dumbbells close together over the centre of the chest and squeeze through the pecs. Then, with control, draw the dumbbells apart and down back to starting position.' },
  'Pec Deck / Fly Machine': { video: '0HSczJ4qydY', desc: 'Pec Deck begins seated with your back flat against the pad, arms open wide gripping the handles at chest height. Bring the handles together in front of your chest by squeezing through the pecs, maintaining a slight bend in the elbows throughout. Pause and squeeze at the closed position, then return the handles under control to the fully stretched position.' },
  'Chest Supported Dumbbell Row': { video: 'nRWvZxbMUgE', desc: 'Chest Supported Dumbbell Row begins with your chest against an incline bench set at approximately 30-45 degrees, a dumbbell in each hand hanging at full extension. Drive the elbows up and back, squeezing the shoulder blades together at the top. Lower the dumbbells under control to full extension, maintaining contact with the bench throughout.' },
  'Cable Seated Row (narrow grip)': { video: 'C_va5FQdyI8', desc: 'Cable Seated Row begins seated at the cable row station with feet on the footplate, knees slightly bent, gripping the narrow handle with arms fully extended. Pull the handle to the lower chest by driving the elbows back, squeezing the shoulder blades together at peak contraction. Return the handle under control to full extension, allowing the shoulders to protract and stretch at the end.' },
  'Seated Shoulder Press Machine (Gymleco)': { video: 'WIyRdcauQVE', desc: 'Seated Shoulder Press begins with your back flat against the pad, gripping the handles at shoulder height with elbows bent. Press the handles overhead to full arm extension, keeping your core braced and back against the pad. Lower the handles under control back to shoulder height, maintaining tension throughout the movement.' },
  'Cable Lateral Raise (cross body)': { video: '2OMbdPF7mz4', desc: 'Cable Cross Body Lateral Raise begins standing side-on to a low cable, grasping the handle with the far hand across the body. Raise the arm out to the side and up to approximately shoulder height, leading with the elbow, keeping a slight bend in the arm. Lower the cable under control back across the body to the starting position.' },
  'Rear Delt Row': { video: 'vzzu0E0ruM8', desc: 'Rear Delt Row begins in a hinged position with a flat back, holding dumbbells or a barbell with arms extended. Row the weight up with elbows flared wide, targeting the rear deltoids and upper back. Squeeze at the top, then lower under control to full extension. Use a yoga block for additional range of motion if needed.' },
  'Preacher Curl Machine': { video: 'MBXni1sgLA0', desc: 'Preacher Curl Machine begins seated with upper arms resting flat against the pad, gripping the handles at full arm extension. Curl the handles up by flexing at the elbow, squeezing the biceps hard at the top of the movement. Lower the handles under control back to full extension, maintaining contact with the pad throughout.' },
  'Cable Tricep Pushdown (straight bar)': { video: '68kjoCtOBbA', desc: 'Cable Tricep Pushdown begins standing at a high cable station, gripping the straight bar with an overhand grip, elbows pinned to your sides. Push the bar down by extending the elbows until arms are fully straight, squeezing the triceps at the bottom. Return the bar under control to the starting position, keeping the elbows stationary throughout.' },
  'Cable Tricep Pushdown (rope)': { video: 'z7gqbcjkzU0', desc: 'Cable Tricep Pushdown with Rope begins standing at a high cable station, gripping the rope attachment with a neutral grip, elbows pinned to your sides. Push the rope down by extending the elbows, splitting the rope apart at the bottom and squeezing the triceps. Return the rope under control, keeping the upper arms stationary.' },
  'Seated Hip Abduction': { video: 'HROBe0rbObg', desc: 'Seated Hip Abduction begins seated in the machine with the outside of your thighs against the pads, feet flat on the footrests. Push the pads outward by driving the knees apart, squeezing the outer glutes at full range of motion. Return the pads inward under control to the starting position.' },
  'Leg Press': { video: 'IqjbBRNqJps', desc: 'Leg Press begins seated in the machine with feet shoulder-width apart on the platform, toes slightly turned out. Lower the platform by bending the knees toward the chest, keeping the lower back flat against the pad. Press the platform back up by driving through the heels and midfoot until the legs are almost fully extended, without locking the knees.' },
  'Machine Hip Thrust': { video: 'UVucPKyQVLU', desc: 'Machine Hip Thrust begins seated with your upper back against the pad and the resistance pad across your hips. Drive the hips up to full extension by squeezing the glutes hard at the top, creating a straight line from knees to shoulders. Lower the hips under control back to the starting position.' },
  'Seated Knee Extension': { video: 'GV-l6fjYHOc', desc: 'Seated Knee Extension begins seated in the machine with your shins against the pad and back flat against the seat. Extend the legs by straightening the knees, squeezing the quadriceps at full extension. Lower the weight under control back to the starting position without letting the weight stack touch.' },
  'Seated Knee Extension (tri-set)': { video: 'GV-l6fjYHOc', desc: 'Seated Knee Extension Tri-Set uses three different positions in sequence: bottom range, mid range, and top range. Perform reps in each partial range before moving to the next, keeping constant tension on the quadriceps throughout all three positions.' },
  'Romanian Deadlift': { video: 'rPmC2YBsdKQ', desc: 'Romanian Deadlift begins standing tall with a barbell held at hip height, feet hip-width apart. Hinge at the hips and push them back, lowering the barbell along the thighs and shins while maintaining a flat back and slight knee bend. Lower until you feel a deep stretch in the hamstrings, then drive the hips forward to return to standing, keeping the bar close to the body throughout.' },
  'Machine Crunch': { video: 'V7p_DmkYLZw', desc: 'Machine Crunch begins seated in the crunch machine with your chest against the pad and hands gripping the handles. Crunch forward by flexing the spine, driving the ribs toward the hips and squeezing the abdominals. Return under control to the starting position without fully releasing the tension.' },
  'Incline Chest Press Machine (plate loaded)': { video: 'QrnVDLSBdMo', desc: 'Incline Chest Press Machine begins seated with your back against the inclined pad, gripping the handles at chest height. Press the handles forward and up to full arm extension, squeezing through the upper chest. Return the handles under control to the starting position, feeling the stretch across the chest.' },
  'Plate Loaded Lat Pulldown': { video: 'I7ZS5x9rdKE', desc: 'Plate Loaded Lat Pulldown begins seated with thighs secured, gripping the handles at full arm extension. Pull the handles down by driving the elbows toward the hips, squeezing the lats at the bottom of the movement. Return the handles under control to full extension, feeling the stretch through the lats at the top.' },
  'Seated Row Machine (Pannatta)': { video: 'C_va5FQdyI8', desc: 'Seated Row Machine begins with your chest supported against the pad, arms fully extended gripping the handles. Pull the handles back by driving the elbows behind the body, squeezing the shoulder blades together at peak contraction. Return the handles under control to full extension, allowing a complete stretch.' },
  'Lateral Raise Machine': { video: 'hrHdBATGcS8', desc: 'Lateral Raise Machine begins seated with your arms against the pads at your sides. Raise the arms out to the side until they reach approximately shoulder height, leading with the elbows. Lower the arms under control back to the starting position without letting the weight stack rest.' },
  'Dumbbell Hammer Curl': { video: 'TUhC873MuQ4', desc: 'Dumbbell Hammer Curl begins standing with a dumbbell in each hand at your sides, palms facing inward in a neutral grip. Curl the dumbbells up by flexing at the elbow, keeping the wrists neutral throughout. Squeeze the biceps and brachialis at the top, then lower under control to full extension.' },
  'Laying Hamstring Curl': { video: 'bvs-Y_qgghE', desc: 'Laying Hamstring Curl begins lying face down on the machine with the pad positioned just above the ankles and hips pressed into the bench. Curl the pad up toward the glutes by flexing at the knees, squeezing the hamstrings at the top. Lower the weight under control back to full extension without letting the weight stack touch.' },
  '45 Degree Hyper Extension': { video: 'TbvbjEoVj8Q', desc: '45 Degree Hyper Extension begins with your hips on the pad, feet anchored, and body hinged forward. Hold a dumbbell at the chest for added resistance. Extend at the hips to raise the torso until the body forms a straight line, squeezing the hamstrings and glutes. Lower under control back to the starting position.' },
  'Leg Press (high foot placement)': { video: 'IqjbBRNqJps', desc: 'Leg Press with High Foot Placement begins seated with feet placed high and wide on the platform, targeting the glutes and hamstrings more than a standard placement. Lower the platform by bending the knees, keeping the lower back flat. Press back up through the heels to full extension.' },
  'Hack Squat or Smith Machine Squat': { video: '6teL-OyXuQs', desc: 'Hack Squat begins standing in the machine with shoulders under the pads, feet shoulder-width apart on the platform. Lower your body by bending the knees and hips, descending to full depth while keeping the torso upright. Drive back up through the quads to full extension.' },
  'EZ Bar Bicep Curl': { video: 'okgRUF0OM0w', desc: 'EZ Bar Bicep Curl begins standing with feet hip-width apart, gripping the EZ bar on the angled portions with an underhand grip. Curl the bar up by flexing at the elbows, keeping the upper arms stationary. Squeeze the biceps at the top, then lower the bar under control to full extension.' },
  'Overhead Tricep Extension': { video: 'zX-H5d_YYmI', desc: 'Overhead Tricep Extension begins standing or seated, holding a cable attachment or dumbbell overhead with arms extended. Lower the weight behind the head by bending at the elbows, keeping the upper arms close to the ears. Extend the arms back to the starting position by squeezing the triceps.' },
  'Seated Hamstring Curl': { video: 'fDoVmFnnOE0', desc: 'Seated Hamstring Curl begins seated with the pad positioned above the ankles and thighs secured. Curl the pad down and back by flexing at the knees, squeezing the hamstrings at the bottom. Return the weight under control to the starting position.' },
  'Chest Supported Machine Row': { video: '7oqpWiwSjtY', desc: 'Chest Supported Machine Row begins with your chest against the pad, arms fully extended gripping the handles. Pull the handles back by driving the elbows behind the body, squeezing the shoulder blades together. Return under control to full extension.' },
  'Rear Fly Machine': { video: 'rd13vNldjzo', desc: 'Rear Fly Machine begins seated facing the machine with arms extended forward, gripping the handles at chest height. Open the arms out to the sides by squeezing the rear deltoids and upper back. Return the handles under control to the starting position.' },
  'Standing Bicep Curl on Cable Machine': { video: 'obFKEQEAink', desc: 'Standing Bicep Curl on Cable Machine begins standing facing a low cable, gripping the straight bar or rope attachment with arms extended. Curl the attachment up by flexing at the elbows, squeezing the biceps at the top. Lower under control to full extension.' },
  'Standing Cable Tricep Extension': { video: 'z7gqbcjkzU0', desc: 'Standing Cable Tricep Extension begins at a high cable station, gripping the attachment with elbows pinned to your sides. Extend the arms by pushing down, squeezing the triceps at full lockout. Return under control to the starting position.' },
  'Seated Hip Adduction': { video: 'CfTZfTILu3U', desc: 'Seated Hip Adduction begins seated in the machine with the inside of your thighs against the pads, legs spread. Squeeze the pads inward by driving the knees together, contracting the inner thighs. Return the pads outward under control to the starting position.' },
  'Neutral Grip Lat Pulldown': { video: '_edsRrSFlOg', desc: 'Neutral Grip Lat Pulldown begins seated at the pulldown machine with thighs secured, gripping the neutral-grip handles with palms facing each other. Pull the handles down to the upper chest by driving the elbows down and back. Return under control to full extension.' },
  'Neutral Grip Seated Dumbbell Shoulder Press': { video: '-Oe03t8wxc0', desc: 'Neutral Grip Seated Dumbbell Shoulder Press begins seated on a bench with back support, holding dumbbells at shoulder height with palms facing each other. Press the dumbbells overhead to full arm extension. Lower under control back to shoulder height.' },
  'Dumbbell Lateral Raise': { video: 'vNQ7-WBDUKA', desc: 'Dumbbell Lateral Raise begins standing with a dumbbell in each hand at your sides. Raise the arms out to the sides until they reach shoulder height, leading with the elbows and keeping a slight bend in the arms. Lower under control to the starting position.' },
  'Goblet Squat': { video: 'CcpnZqMsu7o', desc: 'Goblet Squat begins standing with feet shoulder-width apart, holding a dumbbell vertically at chest height with both hands cupping the top end. Squat down by pushing the hips back and bending the knees, keeping the chest tall and elbows inside the knees. Drive back up through the heels to standing.' },
  'Glute Kickback Machine': { video: 'iDpJ7FMiFag', desc: 'Glute Kickback Machine begins with one foot on the platform and the other against the pad. Drive the pad back by extending the hip, squeezing the glute at full extension. Return under control to the starting position. Perform all reps on one side before switching.' },
  'Seated Chest Press': { video: 'QrnVDLSBdMo', desc: 'Seated Chest Press begins seated with your back against the pad, gripping the handles at chest height with elbows bent. Press the handles forward to full arm extension, squeezing through the chest. Return under control to the starting position.' },
  'Cable Cross Body Lateral Raise': { video: '2OMbdPF7mz4', desc: 'Cable Cross Body Lateral Raise begins standing side-on to a low cable, grasping the handle with the far hand across the body. Raise the arm out to the side to shoulder height, leading with the elbow. Lower under control back across the body.' },
  'Cable Pallof Press': { video: 'yhzdiYkWWUA', desc: 'Cable Pallof Press begins standing side-on to a cable machine, holding the handle at chest height with both hands. Press the handle straight out in front of the chest, resisting the rotation force from the cable. Hold briefly at full extension, then return the hands to the chest. Keep the core braced throughout.' },
  'Cable Pull Through': { video: 't9_DBEA7wsM', desc: 'Cable Pull Through begins standing facing away from a low cable, straddling the cable with feet wider than hip-width, gripping the rope attachment between the legs. Hinge at the hips, pushing them back while keeping a flat back. Drive the hips forward to standing by squeezing the glutes, pulling the cable through.' },
  'Single Arm Lat Pulldown Machine': { video: '_edsRrSFlOg', desc: 'Single Arm Lat Pulldown begins seated at the machine, gripping one handle with a full grip. Pull the handle down by driving the elbow toward the hip, squeezing the lat at the bottom. Return under control to full extension. Perform all reps on one side before switching.' },
  'Machine Tricep Dip': { video: '0IYKZKNqlmU', desc: 'Machine Tricep Dip begins seated in the dip machine with hands gripping the handles at your sides. Press the handles down by extending the elbows, squeezing the triceps at full lockout. Return under control to the starting position.' },
  'Table Top Crunch': { video: 'MuBXHVOAXNo', desc: 'Table Top Crunch begins lying on your back with knees bent at 90 degrees, shins parallel to the floor. Crunch up by lifting the shoulders off the ground, reaching toward the knees and squeezing the abdominals. Lower under control back to the starting position.' }
};

App.today.showExerciseInfo = function(exerciseName) {
  const info = EXERCISE_INFO[exerciseName] || {};
  const videoId = info.video;
  const desc = info.desc || '';
  const query = encodeURIComponent(exerciseName + ' exercise form how to');
  const ytSearch = `https://www.youtube.com/results?search_query=${query}`;

  let html = `<h2 style="font-size:18px;">${esc(exerciseName)}</h2>`;

  if (videoId) {
    html += `<div style="margin:12px 0;position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;">
      <iframe src="https://www.youtube.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:8px;" allowfullscreen></iframe>
    </div>`;
  } else {
    html += `<div style="margin:12px 0;">
      <a href="${ytSearch}" target="_blank" rel="noopener" class="btn btn-primary btn-block" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:20px;">&#9654;</span> Search Demo Videos
      </a>
    </div>`;
  }

  if (desc) {
    html += `<div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:12px;color:var(--accent-light);font-weight:600;margin-bottom:6px;">Description</div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;">${desc}</div>
    </div>`;
  }

  if (videoId) {
    html += `<a href="${ytSearch}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:8px;font-size:12px;color:var(--text-dim);">Search more videos</a>`;
  }
  html += `<button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="App.modal.forceClose()">Close</button>`;
  App.modal.open(html);
};

App.today.showExerciseHistory = function(exerciseName) {
  const sessions = Store.get(sessionsKey()) || [];
  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';
  const matches = [];
  for (let i = sessions.length - 1; i >= 0 && matches.length < 5; i--) {
    const s = sessions[i];
    const ex = s.exercises.find(e => e.name === exerciseName);
    if (ex) matches.push({ date: s.date, exercise: ex });
  }
  let html = `<h2>${esc(exerciseName)}</h2><p style="color:var(--text-dim);font-size:13px;margin-bottom:12px;">Last ${matches.length} session${matches.length !== 1 ? 's' : ''}</p>`;
  if (matches.length === 0) {
    html += '<p style="color:var(--text-dim);">No history yet for this exercise.</p>';
  } else {
    matches.forEach(m => {
      const doneSets = m.exercise.sets.filter(s => s.status === 'done');
      const maxWeight = doneSets.length > 0 ? Math.max(...doneSets.map(s => s.actualWeight)) : 0;
      const totalVol = doneSets.reduce((a, s) => a + s.actualWeight * s.actualReps, 0);
      html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:600;">${formatDate(m.date)}</span>
          ${m.exercise.rpe ? `<span style="font-size:12px;color:var(--text-dim);">RPE ${m.exercise.rpe}</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text-dim);">
          ${m.exercise.sets.map((s, si) => {
            if (s.status === 'done') return `<span style="background:var(--card);padding:3px 8px;border-radius:6px;">${s.actualWeight}${unit} x ${s.actualReps}</span>`;
            if (s.status === 'skipped') return `<span style="background:var(--card);padding:3px 8px;border-radius:6px;opacity:0.5;">Skip</span>`;
            return '';
          }).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Max: ${maxWeight}${unit} | Vol: ${Math.round(totalVol)}${unit}</div>
      </div>`;
    });
  }
  html += `<div style="margin-top:12px;display:flex;gap:8px;">
    <button class="btn btn-outline btn-block" style="flex:1;" onclick="App.chart.show('${escJs(exerciseName)}');App.modal.forceClose();">Chart</button>
    <button class="btn btn-primary btn-block" style="flex:1;" onclick="App.modal.forceClose()">Close</button>
  </div>`;
  App.modal.open(html);
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

// Per-exercise unit overrides (e.g. Preacher Curl Machine → lbs)
function getUnitOverrides() {
  try { return JSON.parse(localStorage.getItem('_rulecoach_unit_overrides')) || {}; } catch { return {}; }
}
function getExerciseUnit(exName, defaultUnit) {
  return getUnitOverrides()[exName] || defaultUnit;
}
App.today.toggleExerciseUnit = function(ei) {
  const ex = App.activeSession.exercises[ei];
  const settings = Store.get('rulecoach_settings') || {};
  const defaultUnit = settings.units || 'kg';
  const overrides = getUnitOverrides();
  const current = overrides[ex.name] || defaultUnit;
  overrides[ex.name] = current === 'kg' ? 'lbs' : 'kg';
  localStorage.setItem('_rulecoach_unit_overrides', JSON.stringify(overrides));
  App.today.renderActiveSession(document.getElementById('todayContent'));
};

App.today.renderActiveSession = function(container) {
  const session = App.activeSession;
  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  let html = `
    <div class="workout-header">
      <div>
        <h2>${esc(session.workoutName)}</h2>
        <div style="font-size:13px;color:var(--text-dim);">${formatDate(session.date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="workout-timer-display" id="workoutElapsed">0:00</div>
        <button class="btn btn-cancel-workout" onclick="App.today.cancelWorkout()" title="Cancel workout">&#10005;</button>
      </div>
    </div>`;

  session.exercises.forEach((ex, ei) => {
    const exUnit = getExerciseUnit(ex.name, unit);
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
      if (s.status === 'done') summaryParts.push(`${s.actualWeight}${exUnit} x ${s.actualReps}`);
      else if (s.status === 'failed') summaryParts.push(`${s.actualWeight}${exUnit} x ${s.actualReps} (F)`);
      else if (s.status === 'skipped') summaryParts.push('Skipped');
    });

    html += `
    <div class="${cardClass}" id="exCard${ei}">
      <div class="exercise-header" onclick="App.today.toggleExercise(${ei})">
        <span class="exercise-name">${esc(ex.name)}${ex.hold ? ` <span class="exercise-status-badge" style="background:var(--yellow);color:#000;font-size:10px;padding:2px 7px;vertical-align:middle;" title="${esc(ex.holdReason)}">Held</span>` : ''}</span>
        <span style="display:flex;align-items:center;gap:4px;">
          ${badge}
          <button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 8px;margin-left:8px;" onclick="event.stopPropagation();App.today.swapExercise(${ei})">Swap</button>
        </span>
      </div>
      <div class="exercise-summary">${summaryParts.join(' | ')}</div>
      <div class="exercise-body">`;

    const isCardioExercise = ex.sets.every(s => s.targetWeight === 0 && (
      s.repRange.includes('min') || s.repRange.includes('m') ||
      s.repRange.includes('rounds') || s.repRange.includes('km')
    ));

    // (rest timer is now a global fixed bar — see #globalRestBar)

    if (ex.notes) {
      html += `<div class="exercise-notes">${esc(ex.notes)}</div>`;
    }

    if (!isCardioExercise) {
      html += `<div class="exercise-links">
        <button class="exercise-link-btn" onclick="event.stopPropagation();App.today.showExerciseInfo('${escJs(ex.name)}')">Demo video</button>
        <button class="exercise-link-btn" onclick="event.stopPropagation();App.today.showExerciseHistory('${escJs(ex.name)}')">View history</button>
      </div>`;
    }

    ex.sets.forEach((s, si) => {
      // Detect cardio/time-based sets — no weight input needed
      const isCardioSet = s.targetWeight === 0 && (
        s.repRange.includes('min') ||
        s.repRange.includes('m') ||
        s.repRange.includes('rounds') ||
        s.repRange.includes('km')
      );

      if (isCardioSet) {
        let rowClass = 'set-row' + (s.status === 'done' ? ' set-done' : '');
        const isRounds = s.repRange.includes('rounds');
        const isDistance = s.repRange.includes('km') || /^\d+m$/.test(s.repRange.trim());
        let cardioInput = '';
        if (isRounds) {
          cardioInput = `<select style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px;font-size:13px;" onchange="App.today.updateSet(${ei},${si},'reps',this.value)">
            ${Array.from({length:11}, (_,i) => `<option value="${i}" ${s.actualReps === i ? 'selected' : ''}>${i} round${i !== 1 ? 's' : ''}</option>`).join('')}
          </select>`;
        } else if (isDistance) {
          cardioInput = `<input type="text" placeholder="Time (e.g. 7:30)" value="${esc(s.note || '')}" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px;font-size:13px;width:100px;" onchange="App.today.updateCardioNote(${ei},${si},this.value)">`;
        } else {
          cardioInput = `<span style="color:var(--text-dim);font-size:13px;">${s.note || ''}</span>`;
        }
        html += `
          <div class="${rowClass}" id="setRow${ei}_${si}">
            <div class="set-info">
              <div class="set-label">S${si + 1}</div>
              <div class="set-target">${s.repRange}</div>
            </div>
            <div class="set-inputs" style="flex:1;">
              ${cardioInput}
            </div>
            <div class="set-actions">
              <button class="set-btn set-btn-done ${s.status === 'done' ? 'active' : ''}" onclick="App.today.markSet(${ei},${si},'done')">&#10003;</button>
            </div>
          </div>`;
        return;
      }

      let rowClass = 'set-row';
      if (s.status === 'done') rowClass += ' set-done';
      if (s.status === 'failed') rowClass += ' set-failed';
      if (s.status === 'skipped') rowClass += ' set-done';

      const targetLabel = s.note
        ? esc(s.note)
        : (s.targetWeight > 0 ? `${s.repRange} @ ${s.targetWeight}${exUnit}` : s.repRange);

      const prevEx = session._prevSession
        ? session._prevSession.exercises.find(pe => pe.name === ex.name)
        : null;
      const prevSet = prevEx && prevEx.sets[si] && prevEx.sets[si].status === 'done'
        ? prevEx.sets[si] : null;
      const lastTimeHtml = prevSet
        ? `<div class="set-last-time">Last: ${prevSet.actualWeight}${exUnit} x ${prevSet.actualReps}</div>`
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
            <span class="unit-label" onclick="App.today.toggleExerciseUnit(${ei})" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;">${exUnit}</span>
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

    // RPE only (rest timer is now in banner above)
    html += `
        <div class="exercise-footer">
          <div class="rpe-selector">
            <label>RPE</label>
            <select onchange="App.today.setRpe(${ei}, this.value)">
              <option value="">-</option>
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${ex.rpe == n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>`;
  });

  html += `
    <div class="card" style="margin-top:12px;">
      <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:6px;">Session Notes</label>
      <textarea id="sessionNotes" rows="3" placeholder="How did you feel? Anything to flag..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:14px;resize:none;" onchange="App.today.saveNotes(this.value)">${esc(App.activeSession.notes || '')}</textarea>
    </div>`;

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

App.today.updateCardioNote = function(ei, si, value) {
  if (!App.activeSession) return;
  App.activeSession.exercises[ei].sets[si].note = value;
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
    delete s.doneAt;
  } else {
    s.status = status;
    s.doneAt = Date.now();
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

// Global rest timer — always visible during workout, fixed bar
App.today.showRestBar = function() {
  const bar = document.getElementById('globalRestBar');
  if (bar) bar.classList.add('visible');
};

App.today.hideRestBar = function() {
  const bar = document.getElementById('globalRestBar');
  if (bar) bar.classList.remove('visible', 'running', 'ringing');
};

App.today.resetRestBar = function() {
  // Show bar in idle state with default rest time
  const bar = document.getElementById('globalRestBar');
  const display = document.getElementById('globalRestDisplay');
  const progress = document.getElementById('globalRestProgress');
  const label = document.getElementById('globalRestLabel');
  if (!bar) return;

  bar.classList.remove('running', 'ringing', 'warning');
  if (progress) { progress.style.transition = 'none'; progress.style.width = '0%'; }

  const defaultRest = App._lastRestTime || 120;
  if (display) display.textContent = App.today.formatRestTime(defaultRest);
  if (label) label.textContent = 'Tap to start rest';
};

App.today.startGlobalRest = function(ei) {
  // Stop any existing timer
  if (App.restTimer) {
    if (typeof App.restTimer.cleanup === 'function') App.restTimer.cleanup();
    else clearInterval(App.restTimer.interval);
    App.restTimer = null;
  }

  const ex = ei !== undefined && App.activeSession ? App.activeSession.exercises[ei] : null;
  const total = ex ? (ex.defaultRest || 120) : 120;

  const bar = document.getElementById('globalRestBar');
  const display = document.getElementById('globalRestDisplay');
  const progress = document.getElementById('globalRestProgress');
  const label = document.getElementById('globalRestLabel');
  if (!bar || !display) return;

  // Timestamp-based timer: survives tab being in background
  const endTime = Date.now() + total * 1000;
  const exerciseName = ex ? ex.name : 'Rest';

  bar.classList.add('visible', 'running');
  bar.classList.remove('ringing', 'warning');
  display.textContent = App.today.formatRestTime(total);
  if (label) label.textContent = exerciseName;
  if (progress) { progress.style.width = '100%'; progress.style.transition = 'none'; }

  // Animate progress bar
  requestAnimationFrame(() => {
    if (progress) { progress.style.transition = `width ${total}s linear`; progress.style.width = '0%'; }
  });

  // Ask for notification permission on first timer (if not already granted/denied)
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  // Fire-once completion handler — runs whenever the end time is reached or detected after a background pause
  let completed = false;
  function complete() {
    if (completed) return;
    completed = true;
    cleanupTimer();
    display.textContent = '0:00';
    bar.classList.remove('running');
    bar.classList.add('ringing');
    if (progress) { progress.style.transition = 'none'; progress.style.width = '0%'; }
    App.restTimer = null;

    // Vibrate
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);

    // Audio ping
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

    // Browser notification (fires even when tab is in background)
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('Rest complete', {
          body: exerciseName + ' — time for the next set',
          tag: 'rulecoach-rest',
          silent: false
        });
        setTimeout(() => { try { n.close(); } catch(_) {} }, 8000);
      }
    } catch(e) {}

    // Reset to idle after 5 seconds
    setTimeout(() => {
      if (!App.restTimer) App.today.resetRestBar();
    }, 5000);
  }

  function tick() {
    const remainingMs = endTime - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    if (remaining <= 0) {
      complete();
      return;
    }
    display.textContent = App.today.formatRestTime(remaining);
    // Yellow warning for last 20 seconds
    if (remaining <= 20) bar.classList.add('warning');
    else bar.classList.remove('warning');
  }

  const interval = setInterval(tick, 1000);
  // Also re-sync immediately when the tab becomes visible (browsers throttle setInterval in background)
  function onVisibility() { if (!completed) tick(); }
  document.addEventListener('visibilitychange', onVisibility);
  // Schedule a backup completion check at the exact end time (in case interval is throttled)
  const completionTimeout = setTimeout(() => { if (!completed) complete(); }, total * 1000 + 100);

  // Wake Lock — keep the screen on during the rest timer so the tab doesn't get backgrounded
  // (which would pause JS execution and the timer on mobile browsers)
  let wakeLock = null;
  // Re-acquire on visibility change if we lost it
  function onVisChange() {
    if (document.visibilityState === 'visible' && !wakeLock && !completed) {
      navigator.wakeLock.request('screen').then(l => { wakeLock = l; }).catch(() => {});
    }
  }
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      wakeLock = lock;
      // Re-acquire if released (e.g. user switched tabs then came back)
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => {});
    document.addEventListener('visibilitychange', onVisChange);
  }

  // Single teardown path — used both when the timer completes and when a new
  // timer replaces this one, so listeners and the wake lock never leak
  function cleanupTimer() {
    clearInterval(interval);
    clearTimeout(completionTimeout);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('visibilitychange', onVisChange);
    if (wakeLock) { try { wakeLock.release(); } catch(_) {} wakeLock = null; }
  }

  App.restTimer = {
    interval,
    completionTimeout,
    endTime,
    exerciseIdx: ei,
    cleanup: cleanupTimer
  };
};

App.today.stopGlobalRest = function() {
  if (App.restTimer) {
    if (typeof App.restTimer.cleanup === 'function') App.restTimer.cleanup();
    else clearInterval(App.restTimer.interval);
    App.restTimer = null;
  }
  App.today.resetRestBar();
};

App.today.toggleGlobalRest = function() {
  if (App.restTimer) {
    // Tapping while running stops it
    App.today.stopGlobalRest();
  } else {
    // Manual tap always starts a default 2 min timer
    App.today.startGlobalRest(undefined);
  }
};

// Called when a set is completed — auto-starts rest
App.today.toggleRest = function(ei) {
  App._lastCompletedExIdx = ei;
  App.today.startGlobalRest(ei);
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

  // Duration runs from start to the last set you marked, not to when you tapped
  // Finish — so a session left open overnight doesn't log as 1,400 minutes.
  // Capped at 4h for sessions with no set timestamps.
  let lastDone = 0;
  App.activeSession.exercises.forEach(ex => ex.sets.forEach(s => { if (s.doneAt && s.doneAt > lastDone) lastDone = s.doneAt; }));
  const endTime = lastDone && lastDone > App.workoutStartTime ? lastDone + 60000 : Date.now();
  const elapsed = Math.min(240, Math.max(1, Math.round((endTime - App.workoutStartTime) / 60000)));
  App.activeSession.durationMinutes = elapsed;

  // Clean up session object for storage
  const session = {
    id: App.activeSession.id,
    date: App.activeSession.date,
    workoutName: App.activeSession.workoutName,
    durationMinutes: elapsed,
    notes: App.activeSession.notes || '',
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
  const sessions = Store.get(sessionsKey()) || [];
  sessions.push(session);
  Store.set(sessionsKey(), sessions);

  // Auto-backup: save a snapshot of all data as a safety net
  try {
    localStorage.setItem('_rulecoach_backup', JSON.stringify({
      programme: Store.get('rulecoach_programme'),
      sessions_benn: Store.get('rulecoach_sessions_benn'),
      sessions_bonny: Store.get('rulecoach_sessions_bonny'),
      settings: Store.get('rulecoach_settings'),
      bodyweight: Store.get('rulecoach_bodyweight'),
      backupDate: new Date().toISOString()
    }));
  } catch(e) {}

  // Auto-flip Bonny's week after completing FB2 or FB4
  const _settings = Store.get('rulecoach_settings') || {};
  if (_settings.user === 'bonny') {
    if (session.workoutName === 'Full Body 2' || session.workoutName === 'Full Body 4') {
      Store.set('rulecoach_bonny_week', getBonnyWeek() === 'A' ? 'B' : 'A');
    }
  }

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

  // Calorie estimate: MET 3.5 (strength training) x 3.5 x bodyweight(kg) / 200 per minute
  const bwEntries = Store.get('rulecoach_bodyweight') || [];
  const bw = bwEntries.length ? bwEntries[bwEntries.length - 1].weight : 85;
  const estKcal = Math.round(3.5 * 3.5 * bw / 200 * Math.max(1, elapsed));

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
        <span class="prog-name">${esc(c.exercise)}</span>
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
      <div class="workout-complete-stat"><span class="stat-label">Workout</span><span class="stat-value">${esc(session.workoutName)}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Duration</span><span class="stat-value">${formatDuration(elapsed)}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Sets Completed</span><span class="stat-value">${doneSets}/${totalSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Skipped Sets</span><span class="stat-value">${skippedSets}</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Total Volume</span><span class="stat-value">${Math.round(totalVolume).toLocaleString()} kg</span></div>
      <div class="workout-complete-stat"><span class="stat-label">Est. Calories</span><span class="stat-value">~${estKcal} kcal</span></div>
    </div>
    ${progressionHtml}
    <button class="btn btn-outline btn-block" onclick="App.today.logToAppleHealth(${Math.max(1, elapsed)})" style="margin-bottom:8px;">Log to Apple Health</button>
    <button class="btn btn-primary btn-block" onclick="App.modal.forceClose()">Done</button>`;

  App.modal.open(summaryHtml);

  // Clear active — via Store.set so the cleared state syncs to other devices
  App.activeSession = null;
  App.workoutStartTime = null;
  Store.set('rulecoach_active_session', { session: null, startTime: null });
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  App.today.stopGlobalRest();
  document.getElementById('finishFab').classList.remove('show');

  App.today.render();
};

// Hand the finished workout to the iOS Shortcuts app, which can write to Apple
// Health (a web app can't reach HealthKit directly). Needs a one-time shortcut
// named "Log Rule Coach Workout" — see Settings > Apple Health for setup.
App.today.logToAppleHealth = function(mins) {
  const url = 'shortcuts://run-shortcut?name=' + encodeURIComponent('Log Rule Coach Workout')
    + '&input=text&text=' + encodeURIComponent(String(mins));
  window.location.href = url;
};

// Weight step for progression. Prefer the smallest step actually used for this
// exercise in recent history (real stack/plate increments), so targets stay
// loadable. Fall back to equipment keywords when there isn't enough history.
App.today.getIncrement = function(exerciseName, sessions) {
  const all = sessions || Store.get(sessionsKey()) || [];
  const weights = new Set();
  let seen = 0;
  for (let i = all.length - 1; i >= 0 && seen < 12; i--) {
    const ex = all[i].exercises.find(e => e.name === exerciseName);
    if (!ex) continue;
    seen++;
    ex.sets.forEach(s => { if (s.status === 'done' && s.actualWeight > 0) weights.add(s.actualWeight); });
  }
  const sorted = [...weights].sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const d = Math.round((sorted[i] - sorted[i - 1]) * 100) / 100;
    if (d > 0 && d < step) step = d;
  }
  if (step >= 1.25 && step <= 10) return step;

  const name = exerciseName.toLowerCase();
  if (name.includes('dumbbell')) return 2.5;
  const compoundKeywords = ['bench', 'squat', 'deadlift', 'leg press', 'row', 'overhead press', 'military press', 'hip thrust', 'rack pull', 'barbell'];
  if (compoundKeywords.some(kw => name.includes(kw))) return 2.5;
  return 1.25;
};

App.today.applyAutoProgression = function(completedSession) {
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const programmeKey = user === 'bonny' ? 'rulecoach_programme_bonny' : 'rulecoach_programme';
  const programme = Store.get(programmeKey) || [];
  const allSessions = Store.get(sessionsKey()) || [];
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
  const unit = settings.units || 'kg';

  completedSession.exercises.forEach(ex => {
    const templateEx = workout.exercises.find(e => e.name === ex.name);
    if (!templateEx) return;

    // Skip exercises with 0 weight (e.g. "10 Minute Bike")
    const templateWeight = templateEx.sets[0] ? templateEx.sets[0].targetWeight : 0;
    if (templateWeight === 0) return;

    const increment = App.today.getIncrement(ex.name, allSessions);
    const doneSets = ex.sets.filter(s => s.status === 'done');
    const totalSets = ex.sets.length;
    const attemptedSets = ex.sets.filter(s => s.status !== 'skipped' && s.status !== null);
    // If all sets skipped (machine in use etc), skip progression entirely
    if (doneSets.length === 0) return;

    // Held exercise (e.g. injury management): never change the template weight
    if (templateEx.hold) {
      const held = templateEx.sets[0].targetWeight;
      changes.push({ exercise: ex.name, action: 'hold', from: held, to: held, reason: templateEx.holdReason || 'Held — no progression' });
      return;
    }

    // Use the ACTUAL weight lifted as the baseline, not the template target
    // This handles cases where the user adjusts weight during the workout
    const actualWeight = doneSets[0] ? doneSets[0].actualWeight : templateWeight;
    const mainWeight = actualWeight;
    const allDone = doneSets.length === totalSets;
    const allAttemptedDone = doneSets.length === attemptedSets.length && doneSets.length > 0;
    const hitAllReps = allAttemptedDone &&
      doneSets.every(s => s.actualReps >= s.targetReps);

    // Average reps missed (positive = short, negative = exceeded)
    const avgRepDiff = doneSets.length > 0
      ? doneSets.reduce((sum, s) => sum + (s.targetReps - s.actualReps), 0) / doneSets.length
      : 0;
    // Average reps EXCEEDED target (for crushing-it detection)
    const avgRepExcess = doneSets.length > 0
      ? doneSets.reduce((sum, s) => sum + Math.max(0, s.actualReps - s.targetReps), 0) / doneSets.length
      : 0;

    const rpe = ex.rpe;
    const rpeOk = !rpe || rpe <= 8;

    // Target reps for scaling the miss threshold
    const avgTargetReps = doneSets.length > 0
      ? doneSets.reduce((sum, s) => sum + s.targetReps, 0) / doneSets.length
      : 8;

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

    // Scaled miss threshold: 30% of target reps (e.g. 2 reps on 6-rep set, 4 reps on 12-rep set)
    const missThreshold = Math.max(2, Math.round(avgTargetReps * 0.3));

    // Ramp-back after a layoff: best top-set weight for this exercise in the
    // last 120 days (excluding this session). If today's weight is well below
    // it and all reps were hit, climb back in double steps, without overshooting.
    let recentBest = 0;
    const cutoff = Date.now() - 120 * 86400000;
    for (let i = allSessions.length - 2; i >= 0; i--) {
      if (new Date(allSessions[i].date).getTime() < cutoff) break;
      const pe = allSessions[i].exercises.find(e => e.name === ex.name);
      if (!pe) continue;
      pe.sets.forEach(s => { if (s.status === 'done' && s.actualWeight > recentBest) recentBest = s.actualWeight; });
    }
    const rampingBack = recentBest > 0 && mainWeight + increment < recentBest;

    // Helper: adjust each template set by a delta, anchored to what was actually
    // lifted this session. delta 0 = hold at actual weights; positive/negative
    // = progress/regress from actual weights. Rounds to nearest 0.25kg.
    function adjustTemplateWeights(delta) {
      templateEx.sets.forEach((s, i) => {
        const done = ex.sets[i] && ex.sets[i].status === 'done' ? ex.sets[i] : null;
        const base = done ? done.actualWeight : s.targetWeight;
        s.targetWeight = Math.max(0, Math.round((base + delta) * 4) / 4);
      });
    }

    // Decision logic
    if (avgRepDiff >= missThreshold) {
      // DECREASE: reps well below target (scaled to rep range)
      const newWeight = Math.max(0, mainWeight - increment);
      adjustTemplateWeights(-increment);
      changes.push({ exercise: ex.name, action: 'decrease', from: mainWeight, to: newWeight, reason: `Reps well below target (avg ${Math.round(avgRepDiff)} short)` });
    } else if (hitAllReps && rpeOk && rampingBack) {
      // RAMP BACK: below recent best after a layoff — double step, capped at the best
      const delta = Math.min(increment * 2, Math.round((recentBest - mainWeight) * 4) / 4);
      const newWeight = mainWeight + delta;
      adjustTemplateWeights(delta);
      changes.push({ exercise: ex.name, action: 'increase', from: mainWeight, to: newWeight, reason: `Ramping back towards ${recentBest}${unit}` });
    } else if (hitAllReps && avgRepExcess >= 2) {
      // CRUSHING IT: exceeded target by 2+ reps avg — increase even if recently increased
      const newWeight = mainWeight + increment;
      adjustTemplateWeights(increment);
      let reason = `Exceeded target by avg ${Math.round(avgRepExcess)} reps`;
      if (rpe) reason += `, RPE ${rpe}`;
      changes.push({ exercise: ex.name, action: 'increase', from: mainWeight, to: newWeight, reason });
    } else if (hitAllReps && rpeOk && !recentlyIncreased) {
      // INCREASE: all sets hit, RPE manageable, not back-to-back increase
      const newWeight = mainWeight + increment;
      adjustTemplateWeights(increment);
      let reason = 'All sets completed';
      if (rpe) reason += `, RPE ${rpe}`;
      changes.push({ exercise: ex.name, action: 'increase', from: mainWeight, to: newWeight, reason });
    } else if (hitAllReps && rpeOk && recentlyIncreased) {
      // HOLD: consolidating recent increase — but anchor template to actual weight
      adjustTemplateWeights(0);
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: 'Consolidating recent increase' });
    } else if (hitAllReps && !rpeOk) {
      // HOLD: RPE too high despite hitting reps
      adjustTemplateWeights(0);
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: `RPE ${rpe} — near max effort` });
    } else if (allDone && !hitAllReps && rpeOk) {
      // HOLD: completed but missed some reps, RPE ok — still progressing
      adjustTemplateWeights(0);
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: 'Completed but below target reps' });
    } else if (allDone && !hitAllReps && !rpeOk) {
      // HOLD + FLAG: missed reps AND high RPE — struggling
      adjustTemplateWeights(0);
      changes.push({ exercise: ex.name, action: 'hold', from: mainWeight, to: mainWeight, reason: `Below target reps, RPE ${rpe} — struggling`, struggling: true });
    } else {
      // No decision (e.g. some sets skipped) — still anchor template to what was
      // actually lifted so the next session starts from the right weights
      adjustTemplateWeights(0);
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

  // Save updated programme to correct user key
  Store.set(programmeKey, programme);
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
  Store.set('rulecoach_active_session', { session: null, startTime: null });
  if (App.workoutElapsedInterval) clearInterval(App.workoutElapsedInterval);
  App.today.stopGlobalRest();
  document.getElementById('finishFab').classList.remove('show');
  App.modal.forceClose();
  App.today.render();
};

// ---- HISTORY SCREEN ----
App.history = {};

App.history.render = function() {
  const container = document.getElementById('historyContent');
  const sessions = (Store.get(sessionsKey()) || []).slice().reverse();

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
    <div class="history-swipe-wrap" id="histWrap${idx}">
      <div class="history-swipe-delete" onclick="event.stopPropagation();App.history.deleteSession(${idx})">Delete</div>
      <div class="history-item" id="histItem${idx}" onclick="App.history.toggle(${idx})"
        ontouchstart="App.history._touchStart(event,${idx})" ontouchmove="App.history._touchMove(event,${idx})" ontouchend="App.history._touchEnd(event,${idx})">
        <div class="history-date">${formatDate(s.date)}</div>
        <div class="history-name">${esc(s.workoutName)}</div>
        <div class="history-meta">
          <span>${formatDuration(s.durationMinutes)}</span>
          <span>${doneSets}/${totalSets} sets</span>
          <span>${Math.round(totalVol).toLocaleString()} ${unit}</span>
        </div>
        ${s.notes ? `<div style="font-size:13px;color:var(--text-dim);font-style:italic;margin-top:4px;padding:0 4px;">"${esc(s.notes)}"</div>` : ''}
        <div class="history-detail">`;

    s.exercises.forEach(ex => {
      html += `<div class="history-exercise-block">
        <div class="history-exercise-name">
          ${esc(ex.name)}
          <button class="history-chart-btn" onclick="event.stopPropagation();App.chart.show('${escJs(ex.name)}')">Chart</button>
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

    html += '</div></div></div>';
  });

  container.innerHTML = App.history.renderWeeklySummary(sessions) + html;
};

// Swipe-to-delete touch handling
App.history._swipeState = {};

App.history._touchStart = function(e, idx) {
  const touch = e.touches[0];
  App.history._swipeState = { startX: touch.clientX, startY: touch.clientY, idx: idx, swiping: false };
};

App.history._touchMove = function(e, idx) {
  const st = App.history._swipeState;
  if (st.idx !== idx) return;
  const touch = e.touches[0];
  const dx = touch.clientX - st.startX;
  const dy = touch.clientY - st.startY;

  // Only swipe if horizontal movement > vertical (prevents blocking scroll)
  if (!st.swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
    st.swiping = true;
  }
  if (!st.swiping) return;
  e.preventDefault();

  const el = document.getElementById('histItem' + idx);
  if (!el) return;
  const offset = Math.min(0, Math.max(-80, dx));
  el.style.transition = 'none';
  el.style.transform = 'translateX(' + offset + 'px)';
};

App.history._touchEnd = function(e, idx) {
  const st = App.history._swipeState;
  if (st.idx !== idx) return;
  const el = document.getElementById('histItem' + idx);
  if (!el) return;

  el.style.transition = 'transform .25s ease';
  const currentX = parseFloat(el.style.transform.replace(/[^-\d.]/g, '')) || 0;

  if (currentX < -40) {
    el.classList.add('swiped');
    el.style.transform = '';
  } else {
    el.classList.remove('swiped');
    el.style.transform = '';
  }
  App.history._swipeState = {};
};

App.history.deleteSession = function(idx) {
  // idx is the reversed index (0 = most recent)
  const sessions = Store.get(sessionsKey()) || [];
  const actualIdx = sessions.length - 1 - idx;
  const session = sessions[actualIdx];
  if (!session) return;
  if (!confirm('Delete "' + session.workoutName + '" from ' + formatDate(session.date) + '?')) return;
  sessions.splice(actualIdx, 1);
  Store.set(sessionsKey(), sessions);
  App.history.render();
};

App.history.renderWeeklySummary = function(sessions) {
  if (sessions.length === 0) return '';
  const weeks = {};
  sessions.forEach(s => {
    const d = new Date(s.date);
    const week = `${d.getFullYear()}-W${String(Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay() + 1) / 7)).padStart(2,'0')}`;
    if (!weeks[week]) weeks[week] = { sessions: 0, sets: 0, volume: 0, label: `Week of ${d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}` };
    weeks[week].sessions++;
    weeks[week].sets += s.exercises.reduce((a,e) => a + e.sets.filter(st => st.status === 'done').length, 0);
    weeks[week].volume += s.exercises.reduce((a,e) => a + e.sets.filter(st => st.status === 'done').reduce((b,st) => b + st.actualWeight * st.actualReps, 0), 0);
  });
  // Most recent 4 weeks, newest first (week keys are YYYY-Wnn so they sort lexically)
  const recent = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
  let html = '<div style="margin-bottom:16px;"><h3 style="font-size:14px;color:var(--text-dim);margin-bottom:8px;">Weekly Summary</h3>';
  recent.forEach(([week, data]) => {
    html += `<div class="card" style="margin-bottom:8px;padding:12px;">
      <div style="font-weight:600;font-size:13px;">${data.label}</div>
      <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--text-dim);">
        <span>${data.sessions} session${data.sessions !== 1 ? 's' : ''}</span>
        <span>${data.sets} sets</span>
        <span>${Math.round(data.volume).toLocaleString()} kg volume</span>
      </div>
    </div>`;
  });
  html += '</div>';
  return html;
};

App.history.toggle = function(idx) {
  document.getElementById('histItem' + idx).classList.toggle('expanded');
};

// ---- CHART ----
App.orm = {};
App.orm.calculate = function(weight, reps) {
  if (!weight || !reps || reps < 1) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

App.chart = {};

App.chart.show = function(exerciseName) {
  const sessions = Store.get(sessionsKey()) || [];
  const dataPoints = [];

  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      if (ex.name === exerciseName) {
        const doneSets = ex.sets.filter(set => set.status === 'done');
        const maxWeight = Math.max(...doneSets.map(set => set.actualWeight), 0);
        const totalVolume = doneSets.reduce((sum, set) => sum + set.actualWeight * set.actualReps, 0);
        const bestSet = doneSets.reduce((best, set) => {
          const orm = App.orm.calculate(set.actualWeight, set.actualReps);
          return orm > (best ? App.orm.calculate(best.actualWeight, best.actualReps) : 0) ? set : best;
        }, null);
        const orm = bestSet ? App.orm.calculate(bestSet.actualWeight, bestSet.actualReps) : 0;
        if (maxWeight > 0) {
          dataPoints.push({ date: new Date(s.date), weight: maxWeight, volume: totalVolume, orm: orm });
        }
      }
    });
  });

  if (dataPoints.length < 1) return;

  const settings = Store.get('rulecoach_settings') || {};
  const unit = settings.units || 'kg';

  document.getElementById('chartTitle').textContent = exerciseName;
  document.getElementById('chartModal').classList.add('show');

  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');

  // Render at device pixel ratio for crisp lines on mobile
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = rect.width || 400;
  const H = rect.height || 250;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
  const orms = dataPoints.map(d => d.orm || d.weight);
  const allWeightValues = [...weights, ...orms];
  const minW = Math.min(...allWeightValues) * 0.95;
  const maxW = Math.max(...allWeightValues) * 1.05;

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
  ctx.fillStyle = '#eab308';
  ctx.fillText('\u25CF Est. 1RM', padding.left + 100, 16);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('\u25CF Volume', padding.left + 180, 16);

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

  // ORM line
  ctx.beginPath();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - (((d.orm || d.weight) - minW) / (maxW - minW)) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  dataPoints.forEach((d, i) => {
    const x = padding.left + (i / (dataPoints.length - 1)) * chartW;
    const y = H - padding.bottom - (((d.orm || d.weight) - minW) / (maxW - minW)) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.fill();
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
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const programme = user === 'bonny' ? getBonnyProgramme() : (Store.get('rulecoach_programme') || []);
  const unit = settings.units || 'kg';

  let html = '';
  programme.forEach((w, wi) => {
    html += `
    <div class="programme-day" id="progDay${wi}">
      <div class="programme-day-header" onclick="App.programme.toggle(${wi})">
        <h3>${esc(w.name)} <span style="font-weight:400;color:var(--text-dim);font-size:13px;">— ${esc(w.subtitle)}</span></h3>
        <span class="day-label">${esc(w.day)}</span>
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
          <div class="programme-ex-name">${esc(ex.name)}</div>
          <div class="programme-ex-sets">${esc(setsDesc)}</div>
          ${ex.notes ? `<div class="programme-ex-notes">${esc(ex.notes)}</div>` : ''}
        </div>`;
    });

    if (user !== 'bonny') {
      html += `<button class="btn btn-outline btn-sm programme-edit-btn" onclick="App.programme.edit(${wi})">Edit</button>`;
    }
    html += `
      </div>
    </div>`;
  });

  if (user !== 'bonny') {
    html += `<button class="btn btn-outline btn-block" style="margin-top:12px" onclick="App.programme.reset()">Reset to Default Programme</button>`;
  }

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

  let html = `<h2>Edit ${esc(w.name)}</h2>`;

  w.exercises.forEach((ex, exi) => {
    html += `
    <div style="margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border);">
      <div class="form-group">
        <label>Exercise ${exi + 1}</label>
        <input type="text" id="editExName${exi}" value="${esc(ex.name)}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="editExNotes${exi}" value="${esc(ex.notes || '')}">
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

// ---- SETTINGS ----
App.settings = {};

App.settings.save = function() {
  const settings = Store.get('rulecoach_settings') || {};
  settings.user = settings.user || 'benn';
  settings.units = document.getElementById('settingUnits').value;
  Store.set('rulecoach_settings', settings);
  const btn = document.getElementById('saveSettingsBtn');
  const orig = btn.textContent;
  btn.textContent = 'Saved!';
  btn.style.background = '#22c55e';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
  App.today.render();
};

App.settings.setUser = function(user) {
  const settings = Store.get('rulecoach_settings') || {};
  settings.user = user;
  Store.set('rulecoach_settings', settings);
  App.settings.updateUserButtons();
  App.today.render();
  App.history.render();
  App.programme.render();
};

App.settings.updateUserButtons = function() {
  const settings = Store.get('rulecoach_settings') || {};
  const user = settings.user || 'benn';
  const bennBtn = document.getElementById('profileBenn');
  const bonnyBtn = document.getElementById('profileBonny');
  if (bennBtn) bennBtn.className = user === 'benn' ? 'btn btn-primary btn-block' : 'btn btn-outline btn-block';
  if (bonnyBtn) bonnyBtn.className = user === 'bonny' ? 'btn btn-primary btn-block' : 'btn btn-outline btn-block';
  const toggle = document.getElementById('bonnyWeekToggle');
  if (toggle) toggle.style.display = user === 'bonny' ? 'block' : 'none';
  App.settings.updateBonnyWeekButtons();
};

App.settings.setBonnyWeek = function(week) {
  Store.set('rulecoach_bonny_week', week);
  App.settings.updateBonnyWeekButtons();
  App.today.render();
};

App.settings.updateBonnyWeekButtons = function() {
  const week = getBonnyWeek();
  const btnA = document.getElementById('bonnyWeekA');
  const btnB = document.getElementById('bonnyWeekB');
  if (!btnA || !btnB) return;
  btnA.className = week === 'A' ? 'btn btn-primary btn-block' : 'btn btn-outline btn-block';
  btnB.className = week === 'B' ? 'btn btn-primary btn-block' : 'btn btn-outline btn-block';
};

App.settings.showHealthSetup = function() {
  App.modal.open(`
    <h2>Apple Health Setup</h2>
    <p style="color:var(--text-dim);font-size:14px;line-height:1.6;margin-bottom:12px;">
      One-time setup. After this, the "Log to Apple Health" button on the workout
      summary logs the session to Health (rings, calories, workout list).
    </p>
    <ol style="font-size:14px;line-height:1.8;padding-left:20px;color:var(--text);">
      <li>Open the <b>Shortcuts</b> app on your iPhone</li>
      <li>Tap <b>+</b> to create a new shortcut</li>
      <li>Name it exactly: <b>Log Rule Coach Workout</b></li>
      <li>Add the action <b>Log Workout</b> (search "workout")</li>
      <li>Set Type to <b>Traditional Strength Training</b></li>
      <li>Tap the <b>Duration</b> field, choose <b>Shortcut Input</b> (this receives the minutes)</li>
      <li>Optionally fill <b>Calories</b> using the estimate shown on the workout summary</li>
      <li>Run it once and allow access to Health when asked</li>
    </ol>
    <p style="color:var(--text-dim);font-size:13px;line-height:1.6;margin-top:12px;">
      For real heart rate and calorie data, also start a Traditional Strength Training
      workout on your Apple Watch when you train — the watch writes that to Health
      directly and it merges with the logged workout.
    </p>
    <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="App.modal.forceClose()">Close</button>
  `);
};

// ---- DATA IMPORT/EXPORT ----
App.data = {};

// ---- BODYWEIGHT LOG ----
App.bodyweight = {};

App.bodyweight.log = function() {
  const val = parseFloat(document.getElementById('bwInput').value);
  if (!val || val < 30 || val > 300) return;
  const entries = Store.get('rulecoach_bodyweight') || [];
  entries.push({ date: new Date().toISOString(), weight: val });
  Store.set('rulecoach_bodyweight', entries);
  document.getElementById('bwInput').value = '';
  App.bodyweight.render();
};

App.bodyweight.render = function() {
  const all = Store.get('rulecoach_bodyweight') || [];
  const entries = all.slice(-10).reverse();
  const el = document.getElementById('bwHistory');
  if (!el) return;
  if (entries.length === 0) { el.innerHTML = 'No entries yet.'; }
  else {
    el.innerHTML = entries.map(e => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
      <span>${formatDate(e.date)}</span><span style="color:var(--text);font-weight:600;">${e.weight} kg</span>
    </div>`).join('');
  }
  App.bodyweight.renderTrend(all);
};

// 12-week trend: sparkline plus the change over the last 4 weeks
App.bodyweight.renderTrend = function(all) {
  const trendEl = document.getElementById('bwTrend');
  const canvas = document.getElementById('bwChart');
  if (!trendEl || !canvas) return;
  const cutoff = Date.now() - 84 * 86400000;
  const pts = all.filter(e => new Date(e.date).getTime() >= cutoff).map(e => ({ t: new Date(e.date).getTime(), w: e.weight }));
  if (pts.length < 2) {
    trendEl.textContent = 'Log weekly to see a trend.';
    canvas.style.display = 'none';
    return;
  }
  const latest = pts[pts.length - 1];
  const fourWeeksAgo = latest.t - 28 * 86400000;
  // Nearest entry at or before 4 weeks ago, else the oldest in range
  const ref = [...pts].reverse().find(p => p.t <= fourWeeksAgo) || pts[0];
  const spanDays = Math.max(1, (latest.t - ref.t) / 86400000);
  const change = Math.round((latest.w - ref.w) * 10) / 10;
  const perWeek = Math.round((change / spanDays) * 7 * 100) / 100;
  const sign = change > 0 ? '+' : '';
  trendEl.textContent = `${sign}${change} kg over ${Math.round(spanDays)} days (${sign}${perWeek} kg/week)`;
  trendEl.style.color = change < 0 ? 'var(--green)' : change > 0 ? 'var(--yellow)' : 'var(--text-dim)';

  canvas.style.display = 'block';
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = rect.width || 300, H = 90;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const pad = { l: 36, r: 8, t: 8, b: 8 };
  const minW = Math.min(...pts.map(p => p.w)) - 0.5, maxW = Math.max(...pts.map(p => p.w)) + 0.5;
  const t0 = pts[0].t, t1 = latest.t || t0 + 1;
  const x = p => pad.l + ((p.t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = p => pad.t + (1 - (p.w - minW) / (maxW - minW)) * (H - pad.t - pad.b);
  ctx.strokeStyle = '#2d2d44'; ctx.lineWidth = 1;
  [minW + 0.5, maxW - 0.5].forEach(v => { const yy = y({ w: v }); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke(); });
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
  ctx.fillText((maxW - 0.5).toFixed(1), pad.l - 4, y({ w: maxW - 0.5 }) + 3);
  ctx.fillText((minW + 0.5).toFixed(1), pad.l - 4, y({ w: minW + 0.5 }) + 3);
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(x(p), y(p)) : ctx.moveTo(x(p), y(p)));
  ctx.stroke();
  pts.forEach(p => { ctx.beginPath(); ctx.arc(x(p), y(p), 3, 0, Math.PI * 2); ctx.fillStyle = '#7c3aed'; ctx.fill(); });
};

App.data.exportData = function() {
  const data = {
    programme: Store.get('rulecoach_programme'),
    sessions_benn: Store.get('rulecoach_sessions_benn'),
    sessions_bonny: Store.get('rulecoach_sessions_bonny'),
    settings: Store.get('rulecoach_settings'),
    bodyweight: Store.get('rulecoach_bodyweight'),
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

App.data.importData = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('This will overwrite your current data with the imported backup. Continue?')) return;
      if (data.programme) Store.set('rulecoach_programme', data.programme);
      if (data.sessions_benn) Store.set('rulecoach_sessions_benn', data.sessions_benn);
      if (data.sessions_bonny) Store.set('rulecoach_sessions_bonny', data.sessions_bonny);
      if (data.settings) Store.set('rulecoach_settings', data.settings);
      if (data.bodyweight) Store.set('rulecoach_bodyweight', data.bodyweight);
      App.init();
      App.nav('settings');
      alert('Data imported successfully!');
    } catch (err) {
      alert('Invalid backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

App.data.clearData = function() {
  if (confirm('This will permanently delete ALL your training data. Are you sure?')) {
    if (confirm('Really? This cannot be undone.')) {
      localStorage.removeItem('rulecoach_programme');
      localStorage.removeItem('rulecoach_sessions_benn');
      localStorage.removeItem('rulecoach_sessions_bonny');
      localStorage.removeItem('rulecoach_bonny_week');
      localStorage.removeItem('rulecoach_active_session');
      localStorage.removeItem('rulecoach_bodyweight');
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
  // Stop any playing videos (iframes)
  const overlay = document.getElementById('modalOverlay');
  overlay.querySelectorAll('iframe').forEach(f => { f.src = ''; });
  overlay.classList.remove('show');
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', App.init);
