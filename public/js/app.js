// public/js/app.js

let currentUser = null;

const authView = document.getElementById('auth-view');
const participantView = document.getElementById('participant-view');
const adminView = document.getElementById('admin-view');
const logoutBtn = document.getElementById('logoutBtn');

// Auth elements
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const gotoRegister = document.getElementById('goto-register');
const gotoLogin = document.getElementById('goto-login');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// Participant elements
const participantGreeting = document.getElementById('participantGreeting');
const preferencesForm = document.getElementById('preferencesForm');
const preferencesText = document.getElementById('preferencesText');
const preferencesSuccess = document.getElementById('preferencesSuccess');
const preferencesError = document.getElementById('preferencesError');
const assignmentStatus = document.getElementById('assignmentStatus');
const revealBtn = document.getElementById('revealBtn');
const assignmentResult = document.getElementById('assignmentResult');
const receiverNameEl = document.getElementById('receiverName');
const receiverNotesEl = document.getElementById('receiverNotes');

// Admin elements
const participantsTableBody = document.querySelector('#participantsTable tbody');
const exclusionForm = document.getElementById('exclusionForm');
const exclusionASelect = document.getElementById('exclusionA');
const exclusionBSelect = document.getElementById('exclusionB');
const exclusionsList = document.getElementById('exclusionsList');
const exclusionError = document.getElementById('exclusionError');

const drawStatus = document.getElementById('drawStatus');
const runDrawBtn = document.getElementById('runDrawBtn');
const drawError = document.getElementById('drawError');
const drawSuccess = document.getElementById('drawSuccess');

const assignmentsTableBody = document.querySelector('#assignmentsTable tbody');

// View helpers

function showView(view) {
    authView.classList.add('hidden');
    participantView.classList.add('hidden');
    adminView.classList.add('hidden');

    if (view === 'auth') authView.classList.remove('hidden');
    if (view === 'participant') participantView.classList.remove('hidden');
    if (view === 'admin') adminView.classList.remove('hidden');
}

function setAuthTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    }
}

// Generic request
async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data.error || 'Request failed';
        throw new Error(message);
    }
    return data;
}

// Initial load: check session
async function init() {
    try {
        const data = await api('/api/me', { method: 'GET' });
        if (data.loggedIn && data.user) {
            currentUser = data.user;
            logoutBtn.classList.remove('hidden');
            if (currentUser.isAdmin) {
                showView('admin');
                setupAdminView();
            } else {
                showView('participant');
                setupParticipantView();
            }
        } else {
            currentUser = null;
            logoutBtn.classList.add('hidden');
            showView('auth');
        }
    } catch (err) {
        console.error(err);
        showView('auth');
    }
}

// Auth events

tabLogin.addEventListener('click', () => {
    setAuthTab('login');
});

tabRegister.addEventListener('click', () => {
    setAuthTab('register');
});

gotoRegister.addEventListener('click', () => {
    setAuthTab('register');
});

gotoLogin.addEventListener('click', () => {
    setAuthTab('login');
});

loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';

    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        currentUser = data;
        logoutBtn.classList.remove('hidden');

        if (data.isAdmin) {
            showView('admin');
            setupAdminView();
        } else {
            showView('participant');
            setupParticipantView();
        }
    } catch (err) {
        loginError.textContent = err.message;
    }
});

registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    registerError.textContent = '';

    const formData = new FormData(registerForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const notes = formData.get('notes');

    try {
        const data = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, notes })
        });

        currentUser = data;
        logoutBtn.classList.remove('hidden');

        if (data.isAdmin) {
            showView('admin');
            setupAdminView();
        } else {
            showView('participant');
            setupParticipantView();
        }
    } catch (err) {
        registerError.textContent = err.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await api('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error(err);
    }
    currentUser = null;
    logoutBtn.classList.add('hidden');
    showView('auth');
});

// Participant view setup

function setupParticipantView() {
    if (!currentUser) return;
    participantGreeting.textContent = `Hi ${currentUser.name} 👋`;
    preferencesText.value = currentUser.notes || '';
    preferencesSuccess.textContent = '';
    preferencesError.textContent = '';
    assignmentStatus.textContent = 'Checking draw status...';
    assignmentResult.classList.add('hidden');
    revealBtn.classList.add('hidden');

    checkAssignmentStatus();
}

async function checkAssignmentStatus() {
    try {
        const data = await api('/api/participant/assignment', { method: 'GET' });

        if (!data.hasAssignment) {
            assignmentStatus.textContent =
                'The draw has not been done yet, or your assignment is not available. Check again later.';
            revealBtn.classList.add('hidden');
        } else {
            assignmentStatus.textContent =
                'The draw has been completed. When you are ready, tap the button below to see who you are buying for.';
            revealBtn.classList.remove('hidden');
            // Do not show the result immediately – only when button is clicked.
        }
    } catch (err) {
        assignmentStatus.textContent = 'Could not check draw status. Please try again later.';
        console.error(err);
    }
}

preferencesForm.addEventListener('submit', async e => {
    e.preventDefault();
    preferencesSuccess.textContent = '';
    preferencesError.textContent = '';

    const notes = preferencesText.value;

    try {
        const data = await api('/api/participant/profile', {
            method: 'POST',
            body: JSON.stringify({ notes })
        });

        preferencesSuccess.textContent = 'Preferences saved.';
        currentUser.notes = data.notes;
    } catch (err) {
        preferencesError.textContent = err.message;
    }
});

revealBtn.addEventListener('click', async () => {
    assignmentResult.classList.add('hidden');
    receiverNameEl.textContent = '';
    receiverNotesEl.textContent = '';

    try {
        const data = await api('/api/participant/assignment', { method: 'GET' });
        if (!data.hasAssignment) {
            assignmentStatus.textContent =
                'No assignment found. The draw may not be completed yet.';
            assignmentResult.classList.add('hidden');
            return;
        }

        receiverNameEl.textContent = data.receiver.name;
        receiverNotesEl.textContent =
            data.receiver.notes && data.receiver.notes.trim().length > 0
                ? data.receiver.notes
                : 'No notes added. Use your best judgement!';
        assignmentResult.classList.remove('hidden');
    } catch (err) {
        assignmentStatus.textContent = 'Could not load your assignment.';
        console.error(err);
    }
});

// Admin view setup

async function setupAdminView() {
    await Promise.all([
        loadParticipants(),
        loadExclusions(),
        loadDrawStatusAndAssignments()
    ]);
}

async function loadParticipants() {
    participantsTableBody.innerHTML = '';
    exclusionASelect.innerHTML = '';
    exclusionBSelect.innerHTML = '';

    try {
        const data = await api('/api/admin/participants', { method: 'GET' });
        const participants = data.participants || [];

        for (const p of participants) {
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            const tdEmail = document.createElement('td');
            const tdNotes = document.createElement('td');

            tdName.textContent = p.name;
            tdEmail.textContent = p.email;
            tdNotes.textContent = p.notes || '';

            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            tr.appendChild(tdNotes);
            participantsTableBody.appendChild(tr);

            const optionA = document.createElement('option');
            optionA.value = p.id;
            optionA.textContent = p.name;
            exclusionASelect.appendChild(optionA);

            const optionB = document.createElement('option');
            optionB.value = p.id;
            optionB.textContent = p.name;
            exclusionBSelect.appendChild(optionB);
        }
    } catch (err) {
        console.error('Load participants error:', err);
    }
}

async function loadExclusions() {
    exclusionsList.innerHTML = '';
    exclusionError.textContent = '';

    try {
        const data = await api('/api/admin/exclusions', { method: 'GET' });
        const exclusions = data.exclusions || [];

        for (const ex of exclusions) {
            const li = document.createElement('li');
            li.className = 'exclusion-item';
            li.dataset.id = ex.id;

            const span = document.createElement('span');
            span.textContent = `${ex.aName} ↔ ${ex.bName}`;
            li.appendChild(span);

            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost';
            btn.textContent = 'Remove';
            btn.addEventListener('click', () => deleteExclusion(ex.id));
            li.appendChild(btn);

            exclusionsList.appendChild(li);
        }
    } catch (err) {
        console.error('Load exclusions error:', err);
    }
}

async function deleteExclusion(id) {
    exclusionError.textContent = '';
    try {
        await api(`/api/admin/exclusions/${id}`, { method: 'DELETE' });
        await loadExclusions();
    } catch (err) {
        exclusionError.textContent = err.message;
    }
}

exclusionForm.addEventListener('submit', async e => {
    e.preventDefault();
    exclusionError.textContent = '';

    const aId = exclusionASelect.value;
    const bId = exclusionBSelect.value;

    if (!aId || !bId || aId === bId) {
        exclusionError.textContent = 'Please choose two different people.';
        return;
    }

    try {
        await api('/api/admin/exclusions', {
            method: 'POST',
            body: JSON.stringify({ aId, bId })
        });

        await loadExclusions();
    } catch (err) {
        exclusionError.textContent = err.message;
    }
});

async function loadDrawStatusAndAssignments() {
    drawError.textContent = '';
    drawSuccess.textContent = '';
    assignmentsTableBody.innerHTML = '';

    try {
        const data = await api('/api/admin/assignments', { method: 'GET' });

        if (data.status === 'completed') {
            const date = data.createdAt
                ? new Date(data.createdAt).toLocaleString()
                : '';
            drawStatus.textContent = `Draw completed on ${date}.`;
        } else {
            drawStatus.textContent = 'The draw has not been run yet.';
        }

        const assignments = data.assignments || [];
        for (const a of assignments) {
            const tr = document.createElement('tr');

            const tdGiver = document.createElement('td');
            const tdGiverEmail = document.createElement('td');
            const tdReceiver = document.createElement('td');
            const tdReceiverEmail = document.createElement('td');

            tdGiver.textContent = a.giverName;
            tdGiverEmail.textContent = a.giverEmail;
            tdReceiver.textContent = a.receiverName;
            tdReceiverEmail.textContent = a.receiverEmail;

            tr.appendChild(tdGiver);
            tr.appendChild(tdGiverEmail);
            tr.appendChild(tdReceiver);
            tr.appendChild(tdReceiverEmail);

            assignmentsTableBody.appendChild(tr);
        }
    } catch (err) {
        console.error('Load draw status error:', err);
        drawStatus.textContent = 'Could not load draw status.';
    }
}

runDrawBtn.addEventListener('click', async () => {
    drawError.textContent = '';
    drawSuccess.textContent = '';

    if (!confirm('Run the draw now? This cannot be undone.')) {
        return;
    }

    try {
        const data = await api('/api/admin/run-draw', { method: 'POST' });
        drawSuccess.textContent = data.message || 'Draw completed.';
        if (!data.emailSent) {
            drawSuccess.textContent += ' Emails were not sent (check SMTP configuration).';
        }
        await loadDrawStatusAndAssignments();
    } catch (err) {
        drawError.textContent = err.message;
    }
});

// Start
document.addEventListener('DOMContentLoaded', () => {
    setAuthTab('login');
    init();
});
