// ===== FF BET MANAGER — Hybrid Edition =====
// Works with localStorage (offline) OR Firebase (online)

// ================================================
// 🔥🔥🔥 FIREBASE CONFIG — COLE SEUS DADOS AQUI 🔥🔥🔥
// ================================================
const firebaseConfig = {
    apiKey: "AIzaSyCJE9PpQhKQSug1xa00-LCDJu2Uwmn94",
    authDomain: "apostas-fbet.firebaseapp.com",
    projectId: "apostas-fbet",
    storageBucket: "apostas-fbet.firebasestorage.app",
    messagingSenderId: "626811657885",
    appId: "1:626811657885:web:1653af98d9ceb73fa53e74",
    measurementId: "G-QH2V24VL7Z"
};
// ================================================

// Detect if Firebase is configured
const FIREBASE_READY = firebaseConfig.apiKey !== "COLE_AQUI";

let db = null;
let matchesCol = null;
let playersCol = null;
let presenceCol = null;
let configCol = null;

if (FIREBASE_READY) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    matchesCol = db.collection('matches');
    playersCol = db.collection('players');
    presenceCol = db.collection('presence');
    configCol = db.collection('config');
    console.log('🔥 Firebase conectado! Modo: ONLINE');
} else {
    console.log('📦 Firebase não configurado. Modo: OFFLINE (localStorage)');
}

// Constants
const ADMIN_FEE = 1.00;
const HEARTBEAT_MS = 30000;
const ONLINE_TIMEOUT_MS = 90000;

// State
let currentUser = null;
let heartbeatTimer = null;
let allMatches = [];

// ===== LOCAL STORAGE LAYER =====
const LocalStore = {
    getMatches() {
        return JSON.parse(localStorage.getItem('ffbet_matches') || '[]');
    },
    saveMatches(matches) {
        localStorage.setItem('ffbet_matches', JSON.stringify(matches));
    },
    getPlayers() {
        return JSON.parse(localStorage.getItem('ffbet_players') || '{}');
    },
    savePlayers(players) {
        localStorage.setItem('ffbet_players', JSON.stringify(players));
    },
    getCounter() {
        return parseInt(localStorage.getItem('ffbet_counter') || '0');
    },
    incrementCounter() {
        const c = this.getCounter() + 1;
        localStorage.setItem('ffbet_counter', c.toString());
        return c;
    }
};

// ===== UTILITIES =====
function formatMoney(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    let d;
    if (timestamp.toDate) {
        d = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        d = new Date(timestamp);
    } else {
        d = new Date(timestamp);
    }
    if (isNaN(d.getTime())) return '';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 0) return 'agora';
    if (seconds < 60) return 'agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
}

function isUserOnline(lastSeen) {
    if (!lastSeen) return false;
    const d = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    return (Date.now() - d.getTime()) < ONLINE_TIMEOUT_MS;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function playerKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// ===== PARTICLES =====
function createParticles() {
    const container = document.getElementById('particles');
    const colors = ['#ff6a00', '#ff2d55', '#ffd600', '#3d7aff'];
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 15 + 10}s`;
        p.style.animationDelay = `${Math.random() * 15}s`;
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
}

// ===== CONFETTI =====
function launchConfetti() {
    const colors = ['#ff6a00', '#ff2d55', '#00e676', '#ffd600', '#3d7aff', '#a855f7'];
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.width = `${Math.random() * 10 + 5}px`;
        piece.style.height = `${Math.random() * 10 + 5}px`;
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = '-10px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.animationDuration = `${Math.random() * 2 + 1.5}s`;
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 3000);
    }
}

// ===== TOAST =====
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== LOGIN =====
function initLogin() {
    const saved = sessionStorage.getItem('ffbet_user');
    if (saved) {
        currentUser = saved;
        enterApp();
        return;
    }
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nickname = document.getElementById('nickname-input').value.trim();
        if (!nickname || nickname.length < 2) {
            showToast('⚠️ Nickname deve ter pelo menos 2 caracteres!');
            return;
        }
        currentUser = nickname;
        sessionStorage.setItem('ffbet_user', nickname);
        enterApp();
    });
}

function enterApp() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('header-nickname').textContent = currentUser;

    // Hide online tab if offline mode
    if (!FIREBASE_READY) {
        const onlineBtn = document.querySelector('[data-tab="online"]');
        if (onlineBtn) onlineBtn.style.display = 'none';
        document.getElementById('header-online-count').textContent = 'offline';
        document.getElementById('header-online-count').style.color = '#ffd600';
        document.getElementById('header-online-count').style.background = 'rgba(255, 214, 0, 0.1)';
    }

    if (FIREBASE_READY) {
        startPresence();
        startFirebaseListeners();
    } else {
        loadLocalData();
    }

    updatePayoutPreview();
}

// ===== PRESENCE (Firebase only) =====
function startPresence() {
    if (!FIREBASE_READY) return;
    const key = playerKey(currentUser);
    presenceCol.doc(key).set({
        name: currentUser,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    heartbeatTimer = setInterval(() => {
        presenceCol.doc(key).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
    }, HEARTBEAT_MS);

    window.addEventListener('beforeunload', () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
    });
}

// ===== FIREBASE LISTENERS =====
function startFirebaseListeners() {
    matchesCol.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        allMatches = [];
        snapshot.forEach(doc => allMatches.push({ id: doc.id, ...doc.data() }));
        renderDashboard(allMatches);
        renderActiveMatches(allMatches);
        renderHistory(allMatches);
    }, (err) => {
        console.error('Matches error:', err);
        showToast('⚠️ Erro ao carregar. Verifique o Firebase.');
    });

    playersCol.onSnapshot((snapshot) => {
        const players = [];
        snapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        renderRanking(players);
    }, (err) => console.error('Players error:', err));

    presenceCol.onSnapshot((snapshot) => {
        const users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        renderOnline(users);
    }, (err) => console.error('Presence error:', err));
}

// ===== LOCAL DATA LOADING =====
function loadLocalData() {
    allMatches = LocalStore.getMatches();
    renderDashboard(allMatches);
    renderActiveMatches(allMatches);
    renderHistory(allMatches);

    const playersObj = LocalStore.getPlayers();
    const playersArr = Object.values(playersObj);
    renderRanking(playersArr);
}

// ===== TAB NAVIGATION =====
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(name) {
    navButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${name}"]`);
    const tab = document.getElementById(`tab-${name}`);
    if (btn) btn.classList.add('active');
    if (tab) tab.classList.add('active');
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ===== QUICK BETS =====
document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('bet-amount').value = btn.dataset.value;
        updatePayoutPreview();
    });
});

// ===== PAYOUT PREVIEW =====
const betAmountInput = document.getElementById('bet-amount');

function updatePayoutPreview() {
    const bet = parseFloat(betAmountInput.value) || 0;
    const pot = bet * 2;
    const prize = pot > 0 ? pot - ADMIN_FEE : 0;
    document.getElementById('preview-bet').textContent = formatMoney(bet);
    document.getElementById('preview-pot').textContent = formatMoney(pot);
    document.getElementById('preview-admin').textContent = formatMoney(ADMIN_FEE);
    document.getElementById('preview-winner').textContent = formatMoney(Math.max(0, prize));
}

betAmountInput.addEventListener('input', updatePayoutPreview);

// ===== CREATE MATCH =====
async function getNextMatchNumber() {
    if (!FIREBASE_READY) {
        return LocalStore.incrementCounter();
    }
    const counterRef = configCol.doc('counter');
    try {
        return await db.runTransaction(async (t) => {
            const doc = await t.get(counterRef);
            const newVal = (doc.exists ? (doc.data().value || 0) : 0) + 1;
            t.set(counterRef, { value: newVal });
            return newVal;
        });
    } catch (e) {
        console.error('Counter error:', e);
        return Date.now();
    }
}

document.getElementById('match-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const player1 = document.getElementById('player1').value.trim();
    const player2 = document.getElementById('player2').value.trim();
    const betAmount = parseFloat(betAmountInput.value);

    if (!player1 || !player2 || !betAmount) {
        showToast('⚠️ Preencha todos os campos!');
        return;
    }
    if (betAmount < 0.50) {
        showToast('⚠️ Aposta mínima: R$ 0,50');
        return;
    }
    if (player1.toLowerCase() === player2.toLowerCase()) {
        showToast('⚠️ Os jogadores devem ser diferentes!');
        return;
    }
    const totalPot = betAmount * 2;
    if (totalPot <= ADMIN_FEE) {
        showToast('⚠️ Pote deve ser maior que a taxa!');
        return;
    }

    const btn = document.getElementById('btn-create-match');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Criando...';

    try {
        const matchNumber = await getNextMatchNumber();

        const matchData = {
            matchNumber,
            player1,
            player2,
            betAmount,
            totalPot,
            adminFee: ADMIN_FEE,
            winnerPrize: totalPot - ADMIN_FEE,
            status: 'active',
            winner: null,
            createdBy: currentUser,
            createdAt: FIREBASE_READY ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
            completedAt: null
        };

        if (FIREBASE_READY) {
            await matchesCol.add(matchData);
            // Ensure player docs exist
            for (const name of [player1, player2]) {
                const key = playerKey(name);
                const pDoc = await playersCol.doc(key).get();
                if (!pDoc.exists) {
                    await playersCol.doc(key).set({
                        name, wins: 0, losses: 0,
                        totalEarnings: 0, totalWagered: 0, matches: 0
                    });
                }
                await playersCol.doc(key).update({
                    matches: firebase.firestore.FieldValue.increment(1),
                    totalWagered: firebase.firestore.FieldValue.increment(betAmount)
                });
            }
        } else {
            // Local mode
            matchData.id = 'local_' + matchNumber;
            const matches = LocalStore.getMatches();
            matches.unshift(matchData);
            LocalStore.saveMatches(matches);

            // Update players locally
            const players = LocalStore.getPlayers();
            for (const name of [player1, player2]) {
                const key = playerKey(name);
                if (!players[key]) {
                    players[key] = { name, wins: 0, losses: 0, totalEarnings: 0, totalWagered: 0, matches: 0 };
                }
                players[key].matches++;
                players[key].totalWagered += betAmount;
            }
            LocalStore.savePlayers(players);
            loadLocalData();
        }

        document.getElementById('match-form').reset();
        updatePayoutPreview();
        switchTab('active');
        showToast('🔥 Partida criada com sucesso!');
    } catch (err) {
        console.error('Create match error:', err);
        showToast('❌ Erro ao criar partida!');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔥 CRIAR PARTIDA</span>';
    }
});

// ===== WINNER MODAL =====
let currentMatchId = null;

function openWinnerModal(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) {
        showToast('⚠️ Partida não encontrada!');
        return;
    }
    currentMatchId = matchId;
    document.getElementById('modal-match-info').textContent =
        `Partida #${match.matchNumber || '?'} — Pote: ${formatMoney(match.totalPot)}`;
    document.getElementById('modal-p1-name').textContent = match.player1;
    document.getElementById('modal-p2-name').textContent = match.player2;
    document.getElementById('modal-prize').textContent = formatMoney(match.winnerPrize);
    document.getElementById('modal-overlay').classList.add('show');
}

function closeWinnerModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    currentMatchId = null;
}

async function selectWinner(playerNum) {
    if (!currentMatchId) return;

    const match = allMatches.find(m => m.id === currentMatchId);
    if (!match) return;

    const winner = playerNum === 1 ? match.player1 : match.player2;
    const loser = playerNum === 1 ? match.player2 : match.player1;

    try {
        if (FIREBASE_READY) {
            await matchesCol.doc(currentMatchId).update({
                status: 'completed',
                winner,
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await playersCol.doc(playerKey(winner)).update({
                wins: firebase.firestore.FieldValue.increment(1),
                totalEarnings: firebase.firestore.FieldValue.increment(match.winnerPrize)
            });
            await playersCol.doc(playerKey(loser)).update({
                losses: firebase.firestore.FieldValue.increment(1)
            });
        } else {
            // Local mode
            const matches = LocalStore.getMatches();
            const idx = matches.findIndex(m => m.id === currentMatchId);
            if (idx !== -1) {
                matches[idx].status = 'completed';
                matches[idx].winner = winner;
                matches[idx].completedAt = new Date().toISOString();
                LocalStore.saveMatches(matches);
            }

            const players = LocalStore.getPlayers();
            const wk = playerKey(winner);
            const lk = playerKey(loser);
            if (players[wk]) {
                players[wk].wins++;
                players[wk].totalEarnings += match.winnerPrize;
            }
            if (players[lk]) {
                players[lk].losses++;
            }
            LocalStore.savePlayers(players);
            loadLocalData();
        }

        closeWinnerModal();
        launchConfetti();
        showToast(`🏆 ${winner} venceu e leva ${formatMoney(match.winnerPrize)}!`);
    } catch (err) {
        console.error('Select winner error:', err);
        showToast('❌ Erro ao definir vencedor!');
    }
}

async function cancelMatch(matchId) {
    if (!confirm('Tem certeza que quer cancelar?')) return;

    try {
        if (FIREBASE_READY) {
            await matchesCol.doc(matchId).update({
                status: 'cancelled',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const matches = LocalStore.getMatches();
            const idx = matches.findIndex(m => m.id === matchId);
            if (idx !== -1) {
                matches[idx].status = 'cancelled';
                matches[idx].completedAt = new Date().toISOString();
                LocalStore.saveMatches(matches);
            }
            loadLocalData();
        }
        showToast('❌ Partida cancelada.');
    } catch (err) {
        console.error('Cancel error:', err);
        showToast('❌ Erro ao cancelar!');
    }
}

async function deleteMatch(matchId) {
    if (!confirm('🗑️ Apagar esta partida? Isso não pode ser desfeito!')) return;

    try {
        if (FIREBASE_READY) {
            // Get match data to revert player stats
            const match = allMatches.find(m => m.id === matchId);
            if (match && match.status === 'completed' && match.winner) {
                const winner = match.winner;
                const loser = match.winner === match.player1 ? match.player2 : match.player1;
                // Revert winner stats
                await playersCol.doc(playerKey(winner)).update({
                    wins: firebase.firestore.FieldValue.increment(-1),
                    totalEarnings: firebase.firestore.FieldValue.increment(-match.winnerPrize),
                    matches: firebase.firestore.FieldValue.increment(-1),
                    totalWagered: firebase.firestore.FieldValue.increment(-match.betAmount)
                });
                // Revert loser stats
                await playersCol.doc(playerKey(loser)).update({
                    losses: firebase.firestore.FieldValue.increment(-1),
                    matches: firebase.firestore.FieldValue.increment(-1),
                    totalWagered: firebase.firestore.FieldValue.increment(-match.betAmount)
                });
            } else if (match) {
                // Active or cancelled - just revert match count
                for (const name of [match.player1, match.player2]) {
                    await playersCol.doc(playerKey(name)).update({
                        matches: firebase.firestore.FieldValue.increment(-1),
                        totalWagered: firebase.firestore.FieldValue.increment(-match.betAmount)
                    }).catch(() => {});
                }
            }
            await matchesCol.doc(matchId).delete();
        } else {
            const matches = LocalStore.getMatches();
            const match = matches.find(m => m.id === matchId);
            if (match && match.status === 'completed' && match.winner) {
                const players = LocalStore.getPlayers();
                const wk = playerKey(match.winner);
                const loser = match.winner === match.player1 ? match.player2 : match.player1;
                const lk = playerKey(loser);
                if (players[wk]) {
                    players[wk].wins--;
                    players[wk].totalEarnings -= match.winnerPrize;
                    players[wk].matches--;
                    players[wk].totalWagered -= match.betAmount;
                }
                if (players[lk]) {
                    players[lk].losses--;
                    players[lk].matches--;
                    players[lk].totalWagered -= match.betAmount;
                }
                LocalStore.savePlayers(players);
            } else if (match) {
                const players = LocalStore.getPlayers();
                for (const name of [match.player1, match.player2]) {
                    const k = playerKey(name);
                    if (players[k]) {
                        players[k].matches--;
                        players[k].totalWagered -= match.betAmount;
                    }
                }
                LocalStore.savePlayers(players);
            }
            const filtered = matches.filter(m => m.id !== matchId);
            LocalStore.saveMatches(filtered);
            loadLocalData();
        }
        showToast('🗑️ Partida apagada!');
    } catch (err) {
        console.error('Delete error:', err);
        showToast('❌ Erro ao apagar!');
    }
}

// Modal events
document.getElementById('modal-p1-btn').addEventListener('click', () => selectWinner(1));
document.getElementById('modal-p2-btn').addEventListener('click', () => selectWinner(2));
document.getElementById('modal-cancel').addEventListener('click', closeWinnerModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeWinnerModal();
});

// ===== RENDER: MATCH CARD =====
function renderMatchCard(match, showActions) {
    const isCompleted = match.status === 'completed';
    const p1Class = isCompleted && match.winner === match.player1 ? 'winner' : '';
    const p2Class = isCompleted && match.winner === match.player2 ? 'winner' : '';

    let statusHTML = '';
    if (match.status === 'active') {
        statusHTML = '<span class="match-status active">AO VIVO</span>';
    } else if (isCompleted) {
        statusHTML = '<span class="match-status completed">FINALIZADA</span>';
    } else {
        statusHTML = '<span class="match-status cancelled">CANCELADA</span>';
    }

    const num = match.matchNumber ? `#${match.matchNumber.toString().padStart(3, '0')}` : '';
    const dateStr = formatDate(match.createdAt);

    let footerRight = '';
    const deleteBtn = `<button class="btn-delete-match" onclick="deleteMatch('${match.id}')" title="Apagar">🗑️</button>`;
    if (isCompleted) {
        footerRight = `<span class="match-prize">🏆 ${formatMoney(match.winnerPrize)}</span>${deleteBtn}`;
    } else if (match.status === 'active') {
        footerRight = `
            <div class="match-actions">
                <button class="btn-winner" onclick="openWinnerModal('${match.id}')">🏆 Vencedor</button>
                <button class="btn-cancel-match" onclick="cancelMatch('${match.id}')">✖</button>
                ${deleteBtn}
            </div>`;
    } else {
        footerRight = deleteBtn;
    }

    return `
        <div class="match-card">
            <div class="match-card-header">
                <span class="match-id">${num}</span>
                ${statusHTML}
                <span class="match-date">${dateStr}</span>
            </div>
            <div class="match-players">
                <div class="match-player">
                    <span class="match-player-name ${p1Class}">${escapeHtml(match.player1)}</span>
                    <span class="match-player-bet">${formatMoney(match.betAmount)}</span>
                </div>
                <span class="match-vs">VS</span>
                <div class="match-player">
                    <span class="match-player-name ${p2Class}">${escapeHtml(match.player2)}</span>
                    <span class="match-player-bet">${formatMoney(match.betAmount)}</span>
                </div>
            </div>
            <div class="match-footer">
                <span class="match-pot">💰 ${formatMoney(match.totalPot)}</span>
                ${footerRight}
            </div>
        </div>`;
}

// ===== RENDER: DASHBOARD =====
function renderDashboard(matches) {
    const completed = matches.filter(m => m.status === 'completed');
    const active = matches.filter(m => m.status === 'active');

    document.getElementById('stat-total-matches').textContent = completed.length;
    document.getElementById('stat-total-wagered').textContent = formatMoney(
        completed.reduce((s, m) => s + (m.totalPot || 0), 0)
    );
    document.getElementById('stat-admin-profit').textContent = formatMoney(
        completed.reduce((s, m) => s + (m.adminFee || 0), 0)
    );
    document.getElementById('stat-active-matches').textContent = active.length;

    const recent = matches.slice(0, 5);
    const container = document.getElementById('recent-matches');
    container.innerHTML = recent.length === 0
        ? '<div class="empty-state"><span class="empty-icon">🎯</span><p>Nenhuma partida ainda. Crie a primeira!</p></div>'
        : recent.map(m => renderMatchCard(m, false)).join('');
}

// ===== RENDER: ACTIVE =====
function renderActiveMatches(matches) {
    const active = matches.filter(m => m.status === 'active');
    const badge = document.getElementById('active-badge');

    if (active.length > 0) {
        badge.textContent = active.length;
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
    }

    const container = document.getElementById('active-matches');
    container.innerHTML = active.length === 0
        ? '<div class="empty-state"><span class="empty-icon">😴</span><p>Nenhuma partida ativa.</p></div>'
        : active.map(m => renderMatchCard(m, true)).join('');
}

// ===== RENDER: HISTORY =====
function renderHistory(matches) {
    const finished = matches.filter(m => m.status !== 'active');
    const container = document.getElementById('history-matches');
    container.innerHTML = finished.length === 0
        ? '<div class="empty-state"><span class="empty-icon">📁</span><p>Histórico vazio.</p></div>'
        : finished.map(m => renderMatchCard(m, false)).join('');
}

// ===== RENDER: RANKING =====
function renderRanking(players) {
    const sorted = [...players].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.totalEarnings - a.totalEarnings;
    });

    const container = document.getElementById('ranking-list');
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">🏆</span><p>Nenhum jogador no ranking ainda.</p></div>';
        return;
    }

    container.innerHTML = sorted.map((p, i) => {
        const pos = i + 1;
        const posClass = pos === 1 ? 'top-1' : pos === 2 ? 'top-2' : pos === 3 ? 'top-3' : '';
        const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
        const wr = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(0) : 0;

        return `
            <div class="ranking-item ${posClass}">
                <div class="ranking-position">${medal}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(p.name)}</div>
                    <div class="ranking-stats">${p.wins}V / ${p.losses}D — ${p.matches} partidas — ${wr}%</div>
                </div>
                <div style="text-align:right">
                    <div class="ranking-wins">${p.wins} 🏆</div>
                    <div class="ranking-earnings">${formatMoney(p.totalEarnings)}</div>
                </div>
            </div>`;
    }).join('');
}

// ===== RENDER: ONLINE =====
function renderOnline(users) {
    const onlineUsers = users.filter(u => isUserOnline(u.lastSeen));
    const offlineUsers = users.filter(u => !isUserOnline(u.lastSeen));

    document.getElementById('header-online-count').textContent = `${onlineUsers.length} online`;

    const container = document.getElementById('online-list');
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">👥</span><p>Ninguém por aqui ainda.</p></div>';
        return;
    }

    let html = '';
    if (onlineUsers.length > 0) {
        html += '<div class="online-section-label">🟢 Online agora</div>';
        html += onlineUsers.map(u => `
            <div class="online-item online">
                <div class="online-dot-indicator"></div>
                <div class="online-name">${escapeHtml(u.name)}</div>
                <div class="online-time">${timeAgo(u.lastSeen)}</div>
            </div>`).join('');
    }
    if (offlineUsers.length > 0) {
        html += '<div class="online-section-label offline-label">🔴 Offline</div>';
        html += offlineUsers.map(u => `
            <div class="online-item offline">
                <div class="online-dot-indicator offline"></div>
                <div class="online-name">${escapeHtml(u.name)}</div>
                <div class="online-time">${timeAgo(u.lastSeen)}</div>
            </div>`).join('');
    }
    container.innerHTML = html;
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initLogin();
});
