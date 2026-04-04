// ================================================================
//  Coach Foška — Admin App
//  Vanilla JS + Supabase JS v2
//
//  CONFIG: Swap SUPABASE_KEY for service_role key (Supabase →
//  Settings → API) to bypass RLS for full admin access.
//  ⚠️  Never use service_role key in production public pages.
// ================================================================

const SUPABASE_URL = "https://nsrhhvwytusltnikqplk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zcmhodnd5dHVzbHRuaWtxcGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTU3ODIsImV4cCI6MjA4Nzg5MTc4Mn0.HOmwk1ry3kCN00QePqj9ELyPsjzWFF6fzTYg5a_UEw8";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Global state ────────────────────────────────────────────────
const S = {
  user:         null,
  clients:      [],
  recipes:      [],
  // Workout editor
  workoutExercises: [],  // [{tmpId, name, muscleGroup, sets, reps, restSeconds, tips, wgerExerciseId, sortOrder, id?}]
  // Recipe editor
  recipeIngredients: [], // [{tmpId, name, quantity, unit, calories, protein_g, carbs_g, fat_g, sortOrder, id?}]
  // Meal plan editor
  mealSlots: [],         // [{tmpId, name, mealType, dayOfWeek, recipeId, foods: [{...}], mealId?}]
};

let tmpCounter = 0;
const tmpId = () => `tmp_${++tmpCounter}`;

// ================================================================
//  AUTH
// ================================================================

async function doLogin() {
  const email = q('#l-email').value.trim();
  const pass  = q('#l-password').value;
  const btn   = q('#l-btn');
  const err   = q('#l-err');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    err.textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

async function doLogout() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    S.user = session.user;
    q('#sb-email').textContent = session.user.email;
    q('#login-view').style.display = 'none';
    q('#app-view').classList.add('visible');
    await loadClients();
    await loadRecipes();
    loadOverview();
  } else {
    S.user = null;
    q('#login-view').style.display = 'flex';
    q('#app-view').classList.remove('visible');
  }
});

// ================================================================
//  NAVIGATION
// ================================================================

function navigate(section) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  q(`#s-${section}`)?.classList.add('active');
  document.querySelector(`[data-nav="${section}"]`)?.classList.add('active');

  switch (section) {
    case 'overview': loadOverview(); break;
    case 'clients':  loadClients(); break;
    case 'quotes':   loadQuotes(); break;
    case 'workouts': loadWorkouts(); break;
    case 'recipes':  loadRecipesList(); break;
    case 'meals':    loadMealPlans(); break;
  }
}

// ================================================================
//  OVERVIEW
// ================================================================

async function loadOverview() {
  const [
    { count: uCount },
    { count: wCount },
    { count: mpCount },
    { count: rcCount },
    { data: quoteData },
    { data: recentClients },
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('workouts').select('*', { count: 'exact', head: true }),
    sb.from('meal_plans').select('*', { count: 'exact', head: true }),
    sb.from('recipes').select('*', { count: 'exact', head: true }),
    sb.from('daily_quotes').select('*').eq('is_active', true).limit(1).maybeSingle(),
    sb.from('profiles').select('id,full_name,email,created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  q('#ov-stats').innerHTML = `
    ${statCard('Total clients', uCount ?? 0, 'registered users')}
    ${statCard('Workouts', wCount ?? 0, 'workout plans')}
    ${statCard('Meal plans', mpCount ?? 0, 'nutrition plans')}
    ${statCard('Recipes', rcCount ?? 0, 'recipe templates')}
  `;

  if (quoteData) {
    q('#ov-quote').innerHTML = `
      <div class="card">
        <div class="card-title">Active Daily Quote</div>
        <div class="quote-preview">
          <div class="q-text">"${esc(quoteData.text)}"</div>
          ${quoteData.author ? `<div class="q-author">— ${esc(quoteData.author)}</div>` : ''}
        </div>
      </div>`;
  } else {
    q('#ov-quote').innerHTML = `<div class="card"><div class="card-title">Active Daily Quote</div><div class="empty"><p>No active quote set. <span style="color:var(--accent);cursor:pointer" onclick="navigate('quotes')">Go to Quotes →</span></p></div></div>`;
  }

  if (recentClients?.length) {
    const rows = recentClients.map(c => `
      <tr>
        <td>${esc(c.full_name || '—')}</td>
        <td style="color:var(--muted)">${esc(c.email)}</td>
        <td style="color:var(--muted)">${fmtDate(c.created_at)}</td>
      </tr>`).join('');
    q('#ov-recent').innerHTML = `
      <div class="card">
        <div class="card-title">Recent sign-ups</div>
        <div class="table-wrap">
          <table><thead><tr><th>Name</th><th>Email</th><th>Joined</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>
      </div>`;
  }
}

const statCard = (label, value, sub) => `
  <div class="stat-card">
    <div class="label">${label}</div>
    <div class="value">${value}</div>
    <div class="sub">${sub}</div>
  </div>`;

// ================================================================
//  CLIENTS
// ================================================================

async function loadClients() {
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  S.clients = data || [];
  if (q('#s-clients')?.classList.contains('active') || !document.querySelector('#s-clients')) {
    renderClients();
  }
}

function renderClients() {
  const el = q('#cl-body');
  if (!el) return;
  if (!S.clients.length) { el.innerHTML = '<div class="empty"><p>No clients yet.</p></div>'; return; }

  const rows = S.clients.map(c => `
    <tr>
      <td>${esc(c.full_name || '—')}</td>
      <td style="color:var(--muted)">${esc(c.email)}</td>
      <td>${esc(c.goal || '—')}</td>
      <td>${esc(c.activity_level || '—')}</td>
      <td>${c.onboarding_complete ? '<span class="badge badge-active">Done</span>' : '<span class="badge badge-muted">Pending</span>'}</td>
      <td>${c.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' : '<span class="badge badge-active">Active</span>'}</td>
      <td style="color:var(--muted)">${fmtDate(c.created_at)}</td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="openClientModal('${c.id}')">Edit</button>
        ${c.is_blocked
          ? `<button class="btn btn-ghost btn-sm" onclick="toggleBlock('${c.id}',false)">Unblock</button>`
          : `<button class="btn btn-danger btn-sm" onclick="toggleBlock('${c.id}',true)">Block</button>`}
      </td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Goal</th><th>Activity</th><th>Onboarding</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function openClientModal(id) {
  const c = S.clients.find(x => x.id === id);
  if (!c) return;
  q('#mc-id').value = id;
  q('#mc-title').textContent = c.full_name || c.email || 'Client details';
  q('#mc-notes').value = c.admin_notes || '';
  q('#mc-blocked').checked = !!c.is_blocked;
  q('#mc-msg').textContent = '';
  q('#mc-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
      ${infoRow('Email', c.email)} ${infoRow('Goal', c.goal)}
      ${infoRow('Activity', c.activity_level)} ${infoRow('Age', c.age)}
      ${infoRow('Height', c.height_cm ? c.height_cm + ' cm' : null)} ${infoRow('Weight', c.weight_kg ? c.weight_kg + ' kg' : null)}
      ${infoRow('Joined', fmtDate(c.created_at))}
    </div>`;
  showModal('modal-client');
}

async function saveClientEdit() {
  const id      = q('#mc-id').value;
  const notes   = q('#mc-notes').value.trim() || null;
  const blocked = q('#mc-blocked').checked;
  const { error } = await sb.from('profiles').update({ admin_notes: notes, is_blocked: blocked }).eq('id', id);
  if (error) { q('#mc-msg').innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
  closeModal('modal-client');
  await loadClients();
  renderClients();
}

async function toggleBlock(id, block) {
  await sb.from('profiles').update({ is_blocked: block }).eq('id', id);
  await loadClients();
  renderClients();
}

const infoRow = (label, value) => value
  ? `<div><div style="font-size:11px;color:var(--muted);margin-bottom:2px">${label}</div><div style="font-size:13px">${esc(String(value))}</div></div>`
  : '';

// ================================================================
//  DAILY QUOTES
// ================================================================

async function loadQuotes() {
  const { data, error } = await sb.from('daily_quotes').select('*').order('created_at', { ascending: false });
  if (error) { q('#qt-body').innerHTML = err(error.message); return; }
  const quotes = data || [];

  const active = quotes.find(x => x.is_active);
  if (active) {
    q('#qt-active').style.display = '';
    q('#qt-active-text').textContent = `"${active.text}"`;
    q('#qt-active-author').textContent = active.author ? `— ${active.author}` : '';
  } else {
    q('#qt-active').style.display = 'none';
  }

  if (!quotes.length) { q('#qt-body').innerHTML = '<div class="empty"><p>No quotes yet.</p></div>'; return; }

  const rows = quotes.map(qt => `
    <tr>
      <td style="max-width:340px">${esc(qt.text)}</td>
      <td style="color:var(--muted)">${esc(qt.author || '—')}</td>
      <td>${qt.scheduled_date ? fmtDate(qt.scheduled_date) : '—'}</td>
      <td>${qt.is_active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
      <td class="td-actions">
        ${!qt.is_active ? `<button class="btn btn-ghost btn-sm" onclick="setActiveQuote('${qt.id}')">Set active</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openQuoteModal('${qt.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteQuote('${qt.id}')">Delete</button>
      </td>
    </tr>`).join('');

  q('#qt-body').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Quote</th><th>Author</th><th>Scheduled</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function setActiveQuote(id) {
  // Deactivate all, then activate selected
  await sb.from('daily_quotes').update({ is_active: false }).neq('id', id);
  await sb.from('daily_quotes').update({ is_active: true }).eq('id', id);
  loadQuotes();
}

function openQuoteModal(id) {
  q('#mq-id').value = id || '';
  q('#mq-title').textContent = id ? 'Edit quote' : 'New quote';
  q('#mq-msg').textContent = '';
  if (id) {
    sb.from('daily_quotes').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        q('#mq-text').value = data.text;
        q('#mq-author').value = data.author || '';
        q('#mq-date').value = data.scheduled_date || '';
      }
    });
  } else {
    q('#mq-text').value = '';
    q('#mq-author').value = '';
    q('#mq-date').value = '';
  }
  showModal('modal-quote');
}

async function saveQuote() {
  const id = q('#mq-id').value;
  const payload = {
    text:           q('#mq-text').value.trim(),
    author:         q('#mq-author').value.trim() || null,
    scheduled_date: q('#mq-date').value || null,
    updated_at:     new Date().toISOString(),
  };
  if (!payload.text) { q('#mq-msg').innerHTML = '<span class="error-msg">Quote text is required.</span>'; return; }
  const { error } = id
    ? await sb.from('daily_quotes').update(payload).eq('id', id)
    : await sb.from('daily_quotes').insert(payload);
  if (error) { q('#mq-msg').innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
  closeModal('modal-quote');
  loadQuotes();
}

async function deleteQuote(id) {
  if (!confirm('Delete this quote?')) return;
  await sb.from('daily_quotes').delete().eq('id', id);
  loadQuotes();
}

// ================================================================
//  WORKOUTS
// ================================================================

async function loadWorkouts() {
  const { data, error } = await sb
    .from('workouts')
    .select('*, workout_exercises(*), profiles(full_name)')
    .order('created_at', { ascending: false });

  const el = q('#wk-body');
  if (!el) return;
  if (error) { el.innerHTML = err(error.message); return; }
  const rows = data || [];
  if (!rows.length) { el.innerHTML = '<div class="empty"><p>No workouts yet. Create one above.</p></div>'; return; }

  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Day</th><th>Duration</th><th>Exercises</th><th>Assigned to</th><th>Active</th><th></th></tr></thead>
      <tbody>
        ${rows.map(w => `<tr>
          <td style="font-weight:500">${esc(w.name)}</td>
          <td>${dayName(w.day_of_week)}</td>
          <td>${w.duration_minutes ? w.duration_minutes + ' min' : '—'}</td>
          <td>${w.workout_exercises?.length ?? 0}</td>
          <td>${w.user_id
            ? `<span class="badge badge-assigned">${esc(w.profiles?.full_name || w.user_id.slice(0,8)+'…')}</span>`
            : `<span class="badge badge-global">Global</span>`}</td>
          <td>${w.is_active ? '<span class="badge badge-active">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="openWorkoutDetail('${w.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteWorkout('${w.id}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

async function openWorkoutDetail(id) {
  S.workoutExercises = [];
  q('#wk-id').value = id || '';
  q('#wk-detail-title').textContent = id ? 'Edit workout' : 'New workout';
  q('#wk-save-msg').textContent = '';
  q('#ex-results').style.display = 'none';
  q('#ex-search').value = '';
  await populateSelect('wk-user', S.clients);

  if (id) {
    const { data } = await sb.from('workouts').select('*, workout_exercises(*)').eq('id', id).single();
    if (data) {
      q('#wk-name').value = data.name || '';
      q('#wk-day').value = data.day_of_week ?? '';
      q('#wk-duration').value = data.duration_minutes || '';
      q('#wk-notes').value = data.notes || '';
      q('#wk-user').value = data.user_id || '';
      S.workoutExercises = (data.workout_exercises || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(e => ({ ...e, tmpId: e.id }));
    }
  } else {
    q('#wk-name').value = '';
    q('#wk-day').value = '';
    q('#wk-duration').value = '';
    q('#wk-notes').value = '';
    q('#wk-user').value = '';
  }

  renderExerciseList();
  q('#wk-list-view').style.display = 'none';
  q('#wk-detail-view').style.display = '';
}

function showWorkoutList() {
  q('#wk-detail-view').style.display = 'none';
  q('#wk-list-view').style.display = '';
  loadWorkouts();
}

async function saveWorkout() {
  const id = q('#wk-id').value;
  const payload = {
    name:             q('#wk-name').value.trim(),
    day_of_week:      q('#wk-day').value !== '' ? parseInt(q('#wk-day').value) : null,
    duration_minutes: q('#wk-duration').value ? parseInt(q('#wk-duration').value) : null,
    notes:            q('#wk-notes').value.trim() || null,
    user_id:          q('#wk-user').value || null,
    coach_id:         S.user.id,
    is_active:        true,
  };
  const msg = q('#wk-save-msg');
  if (!payload.name) { msg.innerHTML = '<span class="error-msg">Name is required.</span>'; return; }

  let workoutId = id;
  if (id) {
    const { error } = await sb.from('workouts').update(payload).eq('id', id);
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
  } else {
    const { data, error } = await sb.from('workouts').insert(payload).select().single();
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
    workoutId = data.id;
  }

  // Sync exercises: delete existing, re-insert all
  await sb.from('workout_exercises').delete().eq('workout_id', workoutId);
  if (S.workoutExercises.length) {
    const inserts = S.workoutExercises.map((e, i) => ({
      workout_id:       workoutId,
      name:             e.name,
      muscle_group:     e.muscleGroup || e.muscle_group || null,
      sets:             parseInt(e.sets) || 3,
      reps:             String(e.reps || '10'),
      rest_seconds:     parseInt(e.restSeconds ?? e.rest_seconds) || 60,
      tips:             e.tips || null,
      wger_exercise_id: e.wgerExerciseId ?? e.wger_exercise_id ?? null,
      sort_order:       i,
    }));
    const { error } = await sb.from('workout_exercises').insert(inserts);
    if (error) { msg.innerHTML = `<span class="error-msg">Saved workout but exercises failed: ${error.message}</span>`; return; }
  }

  showWorkoutList();
}

async function deleteWorkout(id) {
  if (!confirm('Delete this workout and all its exercises?')) return;
  await sb.from('workouts').delete().eq('id', id);
  loadWorkouts();
}

// ── Exercise search (WGER API) ───────────────────────────────────

async function searchExercises() {
  const term = q('#ex-search').value.trim();
  if (!term) return;
  const resultsEl = q('#ex-results');
  const loadingEl = q('#ex-loading');
  resultsEl.style.display = 'none';
  loadingEl.style.display = 'block';
  resultsEl.innerHTML = '';

  try {
    const res = await fetch(
      `https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`
    );
    const data = await res.json();
    loadingEl.style.display = 'none';
    const suggestions = data.suggestions || [];
    if (!suggestions.length) {
      resultsEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px">No results found.</div>';
    } else {
      resultsEl.innerHTML = suggestions.slice(0, 15).map(s => `
        <div class="exercise-result-item" onclick="addExerciseFromSearch(${s.data?.id || 0}, '${esc(s.value)}', '${esc(s.data?.category || '')}')">
          <div class="name">${esc(s.value)}</div>
          ${s.data?.category ? `<div class="muscle">${esc(s.data.category)}</div>` : ''}
        </div>`).join('');
    }
    resultsEl.style.display = '';
  } catch (e) {
    loadingEl.style.display = 'none';
    resultsEl.innerHTML = `<div style="padding:12px;color:var(--danger);font-size:12px">Search failed: ${e.message}</div>`;
    resultsEl.style.display = '';
  }
}

function addExerciseFromSearch(wgerId, name, muscleGroup) {
  S.workoutExercises.push({
    tmpId: tmpId(),
    name,
    muscleGroup,
    sets: 3,
    reps: '10',
    restSeconds: 60,
    tips: '',
    wgerExerciseId: wgerId || null,
  });
  q('#ex-results').style.display = 'none';
  q('#ex-search').value = '';
  renderExerciseList();
}

function addExerciseManual() {
  const name = q('#ex-search').value.trim();
  if (!name) return;
  S.workoutExercises.push({ tmpId: tmpId(), name, muscleGroup: '', sets: 3, reps: '10', restSeconds: 60, tips: '', wgerExerciseId: null });
  q('#ex-search').value = '';
  q('#ex-results').style.display = 'none';
  renderExerciseList();
}

function removeExercise(tid) {
  S.workoutExercises = S.workoutExercises.filter(e => e.tmpId !== tid);
  renderExerciseList();
}

function moveExercise(tid, dir) {
  const i = S.workoutExercises.findIndex(e => e.tmpId === tid);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= S.workoutExercises.length) return;
  [S.workoutExercises[i], S.workoutExercises[j]] = [S.workoutExercises[j], S.workoutExercises[i]];
  renderExerciseList();
}

function updateExerciseField(tid, field, value) {
  const ex = S.workoutExercises.find(e => e.tmpId === tid);
  if (ex) ex[field] = value;
}

function renderExerciseList() {
  const el = q('#ex-list');
  if (!S.workoutExercises.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No exercises added yet. Search above or type a name and add manually.</div>';
    return;
  }
  el.innerHTML = S.workoutExercises.map((e, i) => `
    <div class="exercise-row">
      <div class="exercise-row-header">
        <div>
          <span class="ex-name">${esc(e.name)}</span>
          ${e.muscleGroup ? `<span class="ex-muscle">${esc(e.muscleGroup)}</span>` : ''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="moveExercise('${e.tmpId}',-1)" ${i===0?'disabled':''}>↑</button>
          <button class="btn btn-ghost btn-sm" onclick="moveExercise('${e.tmpId}',1)" ${i===S.workoutExercises.length-1?'disabled':''}>↓</button>
          <button class="btn btn-danger btn-sm" onclick="removeExercise('${e.tmpId}')">✕</button>
        </div>
      </div>
      <div class="exercise-row-fields">
        <div><label style="font-size:11px;color:var(--muted)">Sets</label>
          <input type="number" value="${e.sets}" min="1" onchange="updateExerciseField('${e.tmpId}','sets',this.value)" /></div>
        <div><label style="font-size:11px;color:var(--muted)">Reps (or range)</label>
          <input type="text" value="${esc(String(e.reps))}" placeholder="10 or 8-12" onchange="updateExerciseField('${e.tmpId}','reps',this.value)" /></div>
        <div><label style="font-size:11px;color:var(--muted)">Rest (sec)</label>
          <input type="number" value="${e.restSeconds ?? e.rest_seconds ?? 60}" min="0" onchange="updateExerciseField('${e.tmpId}','restSeconds',this.value)" /></div>
        <div><label style="font-size:11px;color:var(--muted)">Tips / notes</label>
          <input type="text" value="${esc(e.tips||'')}" placeholder="Optional coaching tip" onchange="updateExerciseField('${e.tmpId}','tips',this.value)" /></div>
      </div>
    </div>`).join('');
}

// ================================================================
//  RECIPES
// ================================================================

async function loadRecipes() {
  const { data } = await sb.from('recipes').select('*, recipe_ingredients(*)').order('created_at', { ascending: false });
  S.recipes = data || [];
}

async function loadRecipesList() {
  await loadRecipes();
  const el = q('#rc-body');
  if (!S.recipes.length) { el.innerHTML = '<div class="empty"><p>No recipes yet. Create one above.</p></div>'; return; }

  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Prep</th><th>Servings</th><th>Kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Ingredients</th><th></th></tr></thead>
      <tbody>
        ${S.recipes.map(r => `<tr>
          <td style="font-weight:500">${esc(r.name)}</td>
          <td>${r.prep_time_min ? r.prep_time_min + ' min' : '—'}</td>
          <td>${r.servings ?? 1}</td>
          <td>${r.calories ? Math.round(r.calories) : '—'}</td>
          <td>${r.protein_g ? Math.round(r.protein_g) + 'g' : '—'}</td>
          <td>${r.carbs_g ? Math.round(r.carbs_g) + 'g' : '—'}</td>
          <td>${r.fat_g ? Math.round(r.fat_g) + 'g' : '—'}</td>
          <td>${r.recipe_ingredients?.length ?? 0}</td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="openRecipeDetail('${r.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${r.id}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

async function openRecipeDetail(id) {
  S.recipeIngredients = [];
  q('#rc-id').value = id || '';
  q('#rc-detail-title').textContent = id ? 'Edit recipe' : 'New recipe';
  q('#rc-save-msg').textContent = '';

  if (id) {
    const { data } = await sb.from('recipes').select('*, recipe_ingredients(*)').eq('id', id).single();
    if (data) {
      q('#rc-name').value = data.name || '';
      q('#rc-desc').value = data.description || '';
      q('#rc-prep').value = data.prep_time_min || '';
      q('#rc-servings').value = data.servings || 1;
      q('#rc-cal').value = data.calories || '';
      q('#rc-protein').value = data.protein_g || '';
      q('#rc-carbs').value = data.carbs_g || '';
      q('#rc-fat').value = data.fat_g || '';
      S.recipeIngredients = (data.recipe_ingredients || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(i => ({ ...i, tmpId: i.id }));
    }
  } else {
    ['rc-name','rc-desc','rc-prep','rc-cal','rc-protein','rc-carbs','rc-fat'].forEach(id => q(`#${id}`).value = '');
    q('#rc-servings').value = 1;
  }

  renderIngredientList();
  q('#rc-list-view').style.display = 'none';
  q('#rc-detail-view').style.display = '';
}

function showRecipeList() {
  q('#rc-detail-view').style.display = 'none';
  q('#rc-list-view').style.display = '';
  loadRecipesList();
}

function addIngredientRow(ing) {
  S.recipeIngredients.push({
    tmpId:     tmpId(),
    name:      ing?.name || '',
    quantity:  ing?.quantity || '',
    unit:      ing?.unit || 'g',
    calories:  ing?.calories || '',
    protein_g: ing?.protein_g || '',
    carbs_g:   ing?.carbs_g || '',
    fat_g:     ing?.fat_g || '',
  });
  renderIngredientList();
}

function removeIngredient(tid) {
  S.recipeIngredients = S.recipeIngredients.filter(i => i.tmpId !== tid);
  renderIngredientList();
}

function updateIngredientField(tid, field, value) {
  const ing = S.recipeIngredients.find(i => i.tmpId === tid);
  if (ing) ing[field] = value;
}

function calcRecipeMacros() {
  let cal = 0, prot = 0, carbs = 0, fat = 0;
  S.recipeIngredients.forEach(i => {
    cal   += parseFloat(i.calories)  || 0;
    prot  += parseFloat(i.protein_g) || 0;
    carbs += parseFloat(i.carbs_g)   || 0;
    fat   += parseFloat(i.fat_g)     || 0;
  });
  q('#rc-cal').value     = cal   ? Math.round(cal)   : '';
  q('#rc-protein').value = prot  ? Math.round(prot)  : '';
  q('#rc-carbs').value   = carbs ? Math.round(carbs) : '';
  q('#rc-fat').value     = fat   ? Math.round(fat)   : '';
}

function renderIngredientList() {
  const el = q('#rc-ingredients');
  if (!S.recipeIngredients.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:4px 0 12px">No ingredients yet.</div>';
    return;
  }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:2fr 80px 70px 65px 65px 65px 65px auto;gap:6px;margin-bottom:6px;padding:0 2px">
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Ingredient</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Qty</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Unit</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Kcal</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Protein</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Carbs</span>
      <span style="font-size:10px;color:var(--muted);text-transform:uppercase">Fat</span>
      <span></span>
    </div>` +
    S.recipeIngredients.map(i => `
      <div class="ingredient-row">
        <input type="text"   value="${esc(i.name)}"      placeholder="e.g. Chicken breast" onchange="updateIngredientField('${i.tmpId}','name',this.value)" />
        <input type="number" value="${i.quantity||''}"    placeholder="100" onchange="updateIngredientField('${i.tmpId}','quantity',this.value)" />
        <input type="text"   value="${esc(i.unit||'g')}"  placeholder="g"   onchange="updateIngredientField('${i.tmpId}','unit',this.value)" />
        <input type="number" value="${i.calories||''}"   placeholder="0"   onchange="updateIngredientField('${i.tmpId}','calories',this.value)" />
        <input type="number" value="${i.protein_g||''}"  placeholder="0"   onchange="updateIngredientField('${i.tmpId}','protein_g',this.value)" />
        <input type="number" value="${i.carbs_g||''}"    placeholder="0"   onchange="updateIngredientField('${i.tmpId}','carbs_g',this.value)" />
        <input type="number" value="${i.fat_g||''}"      placeholder="0"   onchange="updateIngredientField('${i.tmpId}','fat_g',this.value)" />
        <button class="btn btn-danger btn-sm" onclick="removeIngredient('${i.tmpId}')">✕</button>
      </div>`).join('') +
    `<button class="btn btn-ghost btn-sm" style="margin-top:4px;margin-bottom:12px" onclick="calcRecipeMacros()">↺ Auto-calculate macros</button>`;
}

async function saveRecipe() {
  const id = q('#rc-id').value;
  const payload = {
    name:          q('#rc-name').value.trim(),
    description:   q('#rc-desc').value.trim() || null,
    prep_time_min: q('#rc-prep').value ? parseInt(q('#rc-prep').value) : null,
    servings:      q('#rc-servings').value ? parseInt(q('#rc-servings').value) : 1,
    calories:      parseFloat(q('#rc-cal').value)     || 0,
    protein_g:     parseFloat(q('#rc-protein').value) || 0,
    carbs_g:       parseFloat(q('#rc-carbs').value)   || 0,
    fat_g:         parseFloat(q('#rc-fat').value)     || 0,
    coach_id:      S.user.id,
    updated_at:    new Date().toISOString(),
  };
  const msg = q('#rc-save-msg');
  if (!payload.name) { msg.innerHTML = '<span class="error-msg">Name is required.</span>'; return; }

  let recipeId = id;
  if (id) {
    const { error } = await sb.from('recipes').update(payload).eq('id', id);
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
  } else {
    const { data, error } = await sb.from('recipes').insert(payload).select().single();
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
    recipeId = data.id;
  }

  // Sync ingredients: delete existing, re-insert all
  await sb.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (S.recipeIngredients.length) {
    const inserts = S.recipeIngredients.map((i, idx) => ({
      recipe_id: recipeId,
      name:      i.name,
      quantity:  parseFloat(i.quantity) || null,
      unit:      i.unit || null,
      calories:  parseFloat(i.calories)  || 0,
      protein_g: parseFloat(i.protein_g) || 0,
      carbs_g:   parseFloat(i.carbs_g)   || 0,
      fat_g:     parseFloat(i.fat_g)     || 0,
      sort_order: idx,
    }));
    const { error } = await sb.from('recipe_ingredients').insert(inserts);
    if (error) { msg.innerHTML = `<span class="error-msg">Saved recipe but ingredients failed: ${error.message}</span>`; return; }
  }

  await loadRecipes();
  showRecipeList();
}

async function deleteRecipe(id) {
  if (!confirm('Delete this recipe and its ingredients?')) return;
  await sb.from('recipes').delete().eq('id', id);
  await loadRecipes();
  loadRecipesList();
}

// ================================================================
//  MEAL PLANS
// ================================================================

async function loadMealPlans() {
  const { data, error } = await sb
    .from('meal_plans')
    .select('*, meal_plan_recipes(*, recipes(name)), profiles(full_name)')
    .order('created_at', { ascending: false });

  const el = q('#mp-body');
  if (!el) return;
  if (error) { el.innerHTML = err(error.message); return; }
  const rows = data || [];
  if (!rows.length) { el.innerHTML = '<div class="empty"><p>No meal plans yet. Create one above.</p></div>'; return; }

  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Assigned to</th><th>Recipes</th><th>Valid from</th><th>Valid to</th><th>Active</th><th></th></tr></thead>
      <tbody>
        ${rows.map(mp => `<tr>
          <td style="font-weight:500">${esc(mp.name)}</td>
          <td>${mp.user_id
            ? `<span class="badge badge-assigned">${esc(mp.profiles?.full_name || mp.user_id.slice(0,8)+'…')}</span>`
            : `<span class="badge badge-global">Global</span>`}</td>
          <td>${mp.meal_plan_recipes?.length ?? 0}</td>
          <td>${mp.valid_from ? fmtDate(mp.valid_from) : '—'}</td>
          <td>${mp.valid_to   ? fmtDate(mp.valid_to)   : '—'}</td>
          <td>${mp.is_active ? '<span class="badge badge-active">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="openMealPlanDetail('${mp.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMealPlan('${mp.id}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

async function openMealPlanDetail(id) {
  S.mealSlots = [];
  q('#mp-id').value = id || '';
  q('#mp-detail-title').textContent = id ? 'Edit meal plan' : 'New meal plan';
  q('#mp-save-msg').textContent = '';
  await populateSelect('mp-user', S.clients);

  if (id) {
    const { data } = await sb
      .from('meal_plans')
      .select('*, meals(*, meal_foods(*))')
      .eq('id', id)
      .single();

    const mprData = await sb.from('meal_plan_recipes').select('*').eq('meal_plan_id', id);
    const mprMap  = {};
    (mprData.data || []).forEach(r => { if (r.meal_id) mprMap[r.meal_id] = r; });

    if (data) {
      q('#mp-name').value = data.name || '';
      q('#mp-desc').value = data.description || '';
      q('#mp-from').value = data.valid_from || '';
      q('#mp-to').value   = data.valid_to   || '';
      q('#mp-user').value = data.user_id    || '';
      S.mealSlots = (data.meals || []).map(m => ({
        tmpId:     m.id,
        mealId:    m.id,
        name:      m.name,
        mealType:  mprMap[m.id]?.meal_type || m.time_of_day || 'meal',
        dayOfWeek: mprMap[m.id]?.day_of_week ?? null,
        recipeId:  mprMap[m.id]?.recipe_id || null,
        foods:     (m.meal_foods || []).map(f => ({ ...f, tmpId: f.id })),
      }));
    }
  } else {
    ['mp-name','mp-desc','mp-from','mp-to'].forEach(id => q(`#${id}`).value = '');
    q('#mp-user').value = '';
  }

  renderMealSlots();
  q('#mp-list-view').style.display = 'none';
  q('#mp-detail-view').style.display = '';
}

function showMealPlanList() {
  q('#mp-detail-view').style.display = 'none';
  q('#mp-list-view').style.display = '';
  loadMealPlans();
}

function addMealSlot() {
  S.mealSlots.push({
    tmpId:     tmpId(),
    mealId:    null,
    name:      '',
    mealType:  'meal',
    dayOfWeek: null,
    recipeId:  null,
    foods:     [],
  });
  renderMealSlots();
}

function removeMealSlot(tid) {
  S.mealSlots = S.mealSlots.filter(s => s.tmpId !== tid);
  renderMealSlots();
}

function updateMealSlotField(tid, field, value) {
  const slot = S.mealSlots.find(s => s.tmpId === tid);
  if (!slot) return;
  slot[field] = value;
  if (field === 'recipeId' && value) loadRecipeIntoSlot(tid, value);
}

async function loadRecipeIntoSlot(tid, recipeId) {
  const slot = S.mealSlots.find(s => s.tmpId === tid);
  if (!slot) return;
  const recipe = S.recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  if (!slot.name) slot.name = recipe.name;
  const { data } = await sb.from('recipe_ingredients').select('*').eq('recipe_id', recipeId);
  slot.foods = (data || []).map(i => ({
    tmpId:       tmpId(),
    name:        i.name,
    amount_grams: i.quantity || 100,
    calories:    i.calories || 0,
    protein_g:   i.protein_g || 0,
    carbs_g:     i.carbs_g || 0,
    fat_g:       i.fat_g || 0,
  }));
  renderMealSlots();
}

function addFoodToSlot(tid) {
  const slot = S.mealSlots.find(s => s.tmpId === tid);
  if (!slot) return;
  slot.foods.push({ tmpId: tmpId(), name: '', amount_grams: 100, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  renderMealSlots();
}

function removeFoodFromSlot(slotTid, foodTid) {
  const slot = S.mealSlots.find(s => s.tmpId === slotTid);
  if (!slot) return;
  slot.foods = slot.foods.filter(f => f.tmpId !== foodTid);
  renderMealSlots();
}

function updateFoodField(slotTid, foodTid, field, value) {
  const slot = S.mealSlots.find(s => s.tmpId === slotTid);
  const food = slot?.foods.find(f => f.tmpId === foodTid);
  if (food) food[field] = value;
}

const MEAL_TYPES = ['breakfast','lunch','dinner','snack','pre-workout','post-workout','meal'];

function renderMealSlots() {
  const el = q('#mp-meals');
  if (!S.mealSlots.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:4px 0 12px">No meals added yet.</div>';
    return;
  }

  const recipeOptions = S.recipes.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');

  el.innerHTML = S.mealSlots.map(slot => `
    <div class="meal-slot">
      <div class="meal-slot-header">
        <div>
          <input type="text" value="${esc(slot.name)}" placeholder="Meal name" style="background:transparent;border:none;border-bottom:1px solid var(--border);border-radius:0;padding:2px 4px;font-weight:600;font-size:13px;width:200px"
            onchange="updateMealSlotField('${slot.tmpId}','name',this.value)" />
        </div>
        <button class="btn btn-danger btn-sm" onclick="removeMealSlot('${slot.tmpId}')">Remove</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Meal type</label>
          <select onchange="updateMealSlotField('${slot.tmpId}','mealType',this.value)">
            ${MEAL_TYPES.map(t => `<option value="${t}" ${slot.mealType===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Day</label>
          <select onchange="updateMealSlotField('${slot.tmpId}','dayOfWeek',this.value===''?null:parseInt(this.value))">
            <option value="" ${slot.dayOfWeek==null?'selected':''}>Every day</option>
            ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i) =>
              `<option value="${i}" ${slot.dayOfWeek===i?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">From recipe (optional)</label>
          <select onchange="updateMealSlotField('${slot.tmpId}','recipeId',this.value||null)">
            <option value="">— Custom / manual —</option>
            ${recipeOptions}
          </select>
        </div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Foods</div>
        ${slot.foods.map(f => `
          <div class="meal-food-row" style="margin-bottom:6px">
            <input type="text"   value="${esc(f.name)}"         placeholder="Food name" onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','name',this.value)" />
            <input type="number" value="${f.amount_grams||100}"  placeholder="g"        onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','amount_grams',parseFloat(this.value))" />
            <input type="number" value="${f.calories||0}"        placeholder="kcal"     onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','calories',parseFloat(this.value))" />
            <input type="number" value="${f.protein_g||0}"       placeholder="P"        onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','protein_g',parseFloat(this.value))" />
            <input type="number" value="${f.carbs_g||0}"         placeholder="C"        onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','carbs_g',parseFloat(this.value))" />
            <input type="number" value="${f.fat_g||0}"           placeholder="F"        onchange="updateFoodField('${slot.tmpId}','${f.tmpId}','fat_g',parseFloat(this.value))" />
            <button class="btn btn-danger btn-sm" onclick="removeFoodFromSlot('${slot.tmpId}','${f.tmpId}')">✕</button>
          </div>`).join('')}
        <button class="btn btn-ghost btn-sm" onclick="addFoodToSlot('${slot.tmpId}')">+ Add food</button>
      </div>
    </div>`).join('');
}

async function saveMealPlan() {
  const id = q('#mp-id').value;
  const payload = {
    name:        q('#mp-name').value.trim(),
    description: q('#mp-desc').value.trim() || null,
    valid_from:  q('#mp-from').value || null,
    valid_to:    q('#mp-to').value   || null,
    user_id:     q('#mp-user').value || null,
    coach_id:    S.user.id,
    is_active:   true,
    updated_at:  new Date().toISOString(),
  };
  const msg = q('#mp-save-msg');
  if (!payload.name) { msg.innerHTML = '<span class="error-msg">Plan name is required.</span>'; return; }

  let planId = id;
  if (id) {
    const { error } = await sb.from('meal_plans').update(payload).eq('id', id);
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
  } else {
    const { data, error } = await sb.from('meal_plans').insert(payload).select().single();
    if (error) { msg.innerHTML = `<span class="error-msg">${error.message}</span>`; return; }
    planId = data.id;
  }

  // Delete old meals (cascades to meal_foods + meal_plan_recipes)
  await sb.from('meals').delete().eq('meal_plan_id', planId);

  // Re-insert meal slots
  for (let i = 0; i < S.mealSlots.length; i++) {
    const slot = S.mealSlots[i];
    const { data: mealData, error: mealErr } = await sb.from('meals').insert({
      meal_plan_id: planId,
      name:         slot.name || slot.mealType || 'Meal',
      time_of_day:  slot.mealType,
      sort_order:   i,
    }).select().single();

    if (mealErr) { msg.innerHTML = `<span class="error-msg">Meal insert failed: ${mealErr.message}</span>`; return; }
    const mealId = mealData.id;

    // Insert foods
    if (slot.foods.length) {
      const foods = slot.foods.map(f => ({
        meal_id:      mealId,
        name:         f.name || 'Food',
        amount_grams: parseFloat(f.amount_grams) || 100,
        calories:     parseFloat(f.calories)     || 0,
        protein_g:    parseFloat(f.protein_g)    || 0,
        carbs_g:      parseFloat(f.carbs_g)      || 0,
        fat_g:        parseFloat(f.fat_g)        || 0,
      }));
      await sb.from('meal_foods').insert(foods);
    }

    // Track recipe link
    if (slot.recipeId) {
      await sb.from('meal_plan_recipes').insert({
        meal_plan_id: planId,
        recipe_id:    slot.recipeId,
        meal_id:      mealId,
        meal_type:    slot.mealType,
        day_of_week:  slot.dayOfWeek,
      });
    }
  }

  showMealPlanList();
}

async function deleteMealPlan(id) {
  if (!confirm('Delete this meal plan?')) return;
  await sb.from('meal_plans').delete().eq('id', id);
  loadMealPlans();
}

// ================================================================
//  UTILITIES
// ================================================================

const q = (sel) => document.querySelector(sel);

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('sk-SK', { day:'2-digit', month:'2-digit', year:'numeric' });
}

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const dayName = (i) => (i != null && i >= 0 && i <= 6) ? DAYS[i] : '—';

function err(msg) {
  return `<div class="error-msg" style="padding:16px">Error: ${esc(msg)}</div>`;
}

function showModal(id) { q(`#${id}`).style.display = 'flex'; }
function closeModal(id) { q(`#${id}`).style.display = 'none'; }
function overlayClose(event, id) { if (event.target.id === id) closeModal(id); }

async function populateSelect(selectId, clients) {
  const sel = q(`#${selectId}`);
  const first = sel.options[0]?.value === '' ? sel.options[0].outerHTML : '';
  sel.innerHTML = first;
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.full_name || c.email || c.id;
    sel.appendChild(opt);
  });
}
