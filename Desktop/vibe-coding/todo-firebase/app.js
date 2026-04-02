/* ─────────────── Firebase Init ─────────────── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPooUlQ2rvdIuYaIRreb4_bMPHsD7JrNg",
  authDomain: "todo-backend-11c85.firebaseapp.com",
  projectId: "todo-backend-11c85",
  storageBucket: "todo-backend-11c85.firebasestorage.app",
  messagingSenderId: "298771864343",
  appId: "1:298771864343:web:f44ccb3991f2033afa7552",
  databaseURL: "https://todo-backend-11c85-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

/* ─────────────── Realtime Database 참조 ─────────────── */
const questsRef = ref(db, 'quests');
const statsRef  = ref(db, 'meta/stats');

/* ─────────────── Config ─────────────── */
const DIFF = {
  Easy:   { exp: 100,  label: '쉬움',   icon: '⚡' },
  Normal: { exp: 150, label: '보통',   icon: '⚔️' },
  Hard:   { exp: 250, label: '어려움', icon: '💀' },
};

const TITLES = [
  '수련생', '견습 모험가', '모험가', '숙련 모험가',
  '베테랑 모험가', '영웅', '전설', '신화', '신성한 존재',
];

const PARTICLE_COLORS = [
  '#ffd700', '#ffb300', '#3ddc6e', '#4da6ff', '#ff5566', '#ffffff', '#cc88ff',
];

/* ─────────────── State ─────────────── */
const S = { totalExp: 0, quests: [], filter: 'all', diff: 'Easy', editId: null, editDiff: 'Easy' };

/* ─────────────── Level Helpers ─────────────── */
function expForLevel(lv) {
  return lv * 200;
}

function levelInfo(totalExp) {
  let lv = 1, used = 0;
  while (true) {
    const need = expForLevel(lv);
    if (totalExp >= used + need) {
      used += need;
      lv++;
    } else {
      const cur = totalExp - used;
      return { lv, cur, need, pct: (cur / need) * 100 };
    }
  }
}

function getTitle(lv) {
  return TITLES[Math.min(lv - 1, TITLES.length - 1)];
}

/* ─────────────── Render ─────────────── */
function updateStats() {
  const info = levelInfo(S.totalExp);

  document.getElementById('lv-num').textContent      = info.lv;
  document.getElementById('title-badge').textContent = getTitle(info.lv);
  document.getElementById('lv-remain').textContent   = info.need - info.cur;
  document.getElementById('exp-text').textContent    = `${info.cur} / ${info.need}`;
  document.getElementById('exp-fill').style.width    = `${Math.min(info.pct, 100)}%`;
  document.getElementById('total-exp').textContent   = S.totalExp;

  const done   = S.quests.filter(q =>  q.done).length;
  const active = S.quests.filter(q => !q.done).length;
  document.getElementById('cnt-done').textContent   = done;
  document.getElementById('cnt-active').textContent = active;
  document.getElementById('cnt-total').textContent  = S.quests.length;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList() {
  const el = document.getElementById('quest-list');

  const items = S.quests.filter(q => {
    if (S.filter === 'active')    return !q.done;
    if (S.filter === 'completed') return  q.done;
    return true;
  });

  if (items.length === 0) {
    const msg =
      S.filter === 'completed' ? '완료된 퀘스트가 없습니다.' :
      S.filter === 'active'    ? '진행 중인 퀘스트가 없습니다.' :
                                 '퀘스트를 추가해서 모험을 시작하세요!';
    el.innerHTML = `<div class="empty"><div class="icon">📋</div><p>${msg}</p></div>`;
    return;
  }

  el.innerHTML = items.map(q => {
    const d = DIFF[q.diff];
    return `
      <div class="quest-card ${q.diff.toLowerCase()} ${q.done ? 'completed' : ''}" id="card-${q.id}">
        <button class="check-btn" onclick="completeQuest('${q.id}')" title="퀘스트 완료">${q.done ? '✓' : ''}</button>
        <div class="quest-body">
          <div class="quest-title">${escapeHtml(q.title)}</div>
          <div class="quest-meta">
            <span class="badge ${q.diff.toLowerCase()}">${d.icon} ${d.label}</span>
            <span class="exp-tag">+${d.exp} EXP</span>
            ${q.done ? '<span class="done-tag">✓ 완료됨</span>' : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="edit-btn" onclick="editQuest('${q.id}')" title="수정">✎</button>
          <button class="del-btn"  onclick="deleteQuest('${q.id}')" title="삭제">✕</button>
        </div>
      </div>`;
  }).join('');
}

/* ─────────────── Actions ─────────────── */
async function addQuest() {
  const inp   = document.getElementById('quest-input');
  const title = inp.value.trim();

  if (!title) {
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
    inp.focus();
    return;
  }

  const newRef = push(questsRef);
  await set(newRef, {
    title,
    diff: S.diff,
    done: false,
    createdAt: Date.now(),
  });

  inp.value = '';
}

async function completeQuest(id) {
  const q = S.quests.find(x => x.id === id);
  if (!q || q.done) return;

  const card = document.getElementById(`card-${id}`);
  if (!card) return;

  const prevLv = levelInfo(S.totalExp).lv;
  card.classList.add('completing');

  setTimeout(async () => {
    await update(ref(db, `quests/${id}`), { done: true });

    S.totalExp += DIFF[q.diff].exp;
    await set(statsRef, { totalExp: S.totalExp });

    const newLv = levelInfo(S.totalExp).lv;
    spawnParticles(card);
    if (newLv > prevLv) setTimeout(() => showModal(newLv), 400);
  }, 500);
}

function editQuest(id) {
  const q = S.quests.find(x => x.id === id);
  if (!q) return;

  S.editId   = id;
  S.editDiff = q.diff;

  document.getElementById('edit-input').value = q.title;

  // 난이도 버튼 상태 초기화
  document.querySelectorAll('[data-edit-diff]').forEach(b => {
    b.classList.toggle('active', b.dataset.editDiff === q.diff);
  });

  const overlay = document.getElementById('edit-modal');
  overlay.style.display = 'flex';
  overlay.classList.remove('closing');

  setTimeout(() => document.getElementById('edit-input').focus(), 100);
}

async function saveEdit() {
  const title = document.getElementById('edit-input').value.trim();
  if (!title) {
    const inp = document.getElementById('edit-input');
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
    return;
  }

  await update(ref(db, `quests/${S.editId}`), {
    title,
    diff: S.editDiff,
  });

  closeEditModal();
}

function closeEditModal() {
  const overlay = document.getElementById('edit-modal');
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('closing');
    S.editId = null;
  }, 250);
}

async function deleteQuest(id) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;

  card.classList.add('deleting');
  setTimeout(async () => {
    await remove(ref(db, `quests/${id}`));
  }, 300);
}

/* ─────────────── Particles ─────────────── */
function spawnParticles(refEl) {
  const rect = refEl.getBoundingClientRect();
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;

  for (let i = 0; i < 18; i++) {
    const p     = document.createElement('div');
    p.className = 'particle';

    const size  = Math.random() * 9 + 4;
    const angle = Math.random() * 360;
    const dist  = Math.random() * 80 + 20;
    const dur   = parseFloat((Math.random() * 0.5 + 0.6).toFixed(2));
    const delay = parseFloat((Math.random() * 0.15).toFixed(2));
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    const tx    = Math.cos(angle * Math.PI / 180) * dist;
    const ty    = Math.sin(angle * Math.PI / 180) * dist - 80;

    p.style.cssText = `
      width:${size}px; height:${size}px;
      background:${color};
      left:${cx - size / 2}px; top:${cy - size / 2}px;
    `;

    p.animate(
      [
        { transform: 'translate(0,0) scale(1)',              opacity: 1 },
        { transform: `translate(${tx}px,${ty}px) scale(0)`, opacity: 0 },
      ],
      { duration: dur * 1000, delay: delay * 1000, easing: 'ease-out', fill: 'forwards' }
    );

    document.body.appendChild(p);
    setTimeout(() => p.remove(), (dur + delay + 0.1) * 1000);
  }
}

/* ─────────────── Modal ─────────────── */
function showModal(lv) {
  document.getElementById('modal-lv').textContent    = lv;
  document.getElementById('modal-title').textContent = getTitle(lv);
  const overlay = document.getElementById('modal');
  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
}

function closeModal() {
  const overlay = document.getElementById('modal');
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('closing');
  }, 250);
}

/* ─────────────── Event Listeners ─────────────── */
document.getElementById('add-btn').addEventListener('click', addQuest);

document.getElementById('quest-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addQuest();
});

document.getElementById('quest-input').addEventListener('animationend', function () {
  this.classList.remove('shake');
});

document.getElementById('edit-save-btn').addEventListener('click', saveEdit);
document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});
document.getElementById('edit-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveEdit();
  if (e.key === 'Escape') closeEditModal();
});
document.querySelectorAll('[data-edit-diff]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-edit-diff]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.editDiff = btn.dataset.editDiff;
  });
});

document.getElementById('modal-ok').addEventListener('click', closeModal);

document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.diff = btn.dataset.diff;
  });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.filter = btn.dataset.f;
    renderList();
  });
});

/* ─────────────── Global 노출 (onclick 핸들러용) ─────────────── */
window.completeQuest = completeQuest;
window.deleteQuest   = deleteQuest;
window.editQuest     = editQuest;

/* ─────────────── Realtime Database 실시간 리스너 ─────────────── */
function initListeners() {
  // 퀘스트 목록 실시간 동기화
  onValue(questsRef, snap => {
    const data = snap.val() || {};
    S.quests = Object.entries(data)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => b.createdAt - a.createdAt);
    renderList();
    updateStats();
  });

  // EXP / 레벨 실시간 동기화
  onValue(statsRef, snap => {
    S.totalExp = snap.exists() ? (snap.val().totalExp || 0) : 0;
    updateStats();
  });
}

/* ─────────────── Init ─────────────── */
initListeners();
