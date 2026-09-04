/* ==========================================================================
   MEDIQ SMART QUEUE - DOCTOR PANEL (FETCH API VERSION)
   ========================================================================== */

const DOCTOR_API_URL = 'http://localhost:5000/api/doctor';

// --- 1. DOM Elements ---
const currentServingDisplay = document.getElementById('currentServingDisplay');
const currentPatientName = document.getElementById('currentPatientName');
const waitingCountDisplay = document.getElementById('waitingCountDisplay');
const completedCountDisplay = document.getElementById('completedCountDisplay');
const delayDisplay = document.getElementById('delayDisplay');
const queueTableBody = document.getElementById('queueTableBody');

// Action Buttons
const callNextBtn = document.getElementById('callNextBtn');
const markCompletedBtn = document.getElementById('markCompletedBtn');
const delayQueueBtn = document.getElementById('delayQueueBtn');
const resetQueueBtn = document.getElementById('resetQueueBtn');
const addSamplePatientBtn = document.getElementById('addSamplePatientBtn');

// --- 2. Render Dashboard from Server Data ---

async function fetchAndRenderDashboard() {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/queue`);
    const result = await response.json();

    if (!result.success || !result.data) {
      console.error('Failed to load queue data:', result.message);
      return;
    }

    const { queue, queueState, metrics } = result.data;
    const currentServingNum = queueState.currentlyServingToken;

    // Find actively consulting patient
    const activePatient = queue.find(
      p => p.tokenNumber === currentServingNum && p.status === 'In-Consultation'
    );

    // Update Top Metric Cards
    if (currentServingNum > 0 && activePatient) {
      currentServingDisplay.textContent = '#' + String(currentServingNum).padStart(2, '0');
      currentPatientName.textContent = `Consulting: ${activePatient.name}`;
    } else if (currentServingNum > 0) {
      currentServingDisplay.textContent = '#' + String(currentServingNum).padStart(2, '0');
      currentPatientName.textContent = 'Ready for Next Patient';
    } else {
      currentServingDisplay.textContent = '#00';
      currentPatientName.textContent = 'Queue Not Started';
    }

    waitingCountDisplay.textContent = metrics.waitingCount;
    completedCountDisplay.textContent = metrics.completedCount;
    delayDisplay.textContent = `${metrics.delayMinutes}m`;

    // Render Table Rows
    queueTableBody.innerHTML = '';

    if (queue.length === 0) {
      queueTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            🏥 No patients in database. Book from Patient View or click "+ Quick Add Sample Patient".
          </td>
        </tr>
      `;
      return;
    }

    queue.forEach(patient => {
      const tr = document.createElement('tr');
      
      if (patient.tokenNumber === currentServingNum && patient.status === 'In-Consultation') {
        tr.classList.add('active-row');
      }

      let badgeClass = 'status-waiting';
      if (patient.status === 'In-Consultation') badgeClass = 'status-consulting';
      if (patient.status === 'Completed') badgeClass = 'status-completed';

      tr.innerHTML = `
        <td><strong>#${String(patient.tokenNumber).padStart(2, '0')}</strong></td>
        <td><strong>${escapeHtml(patient.name)}</strong></td>
        <td>${escapeHtml(patient.phone)}</td>
        <td>${escapeHtml(patient.doctor)}</td>
        <td>${escapeHtml(patient.timeWindow)}</td>
        <td><span class="status-badge ${badgeClass}">${patient.status}</span></td>
        <td>
          ${patient.status === 'Waiting' ? `
            <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto; margin: 0;" onclick="callSpecificPatient(${patient.tokenNumber})">
              Call
            </button>
          ` : patient.status === 'In-Consultation' ? `
            <button class="btn btn-success" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; width: auto; margin: 0;" onclick="markCompleted()">
              Complete
            </button>
          ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">Done</span>`}
        </td>
      `;

      queueTableBody.appendChild(tr);
    });

  } catch (error) {
    console.warn('MediQ backend server unavailable:', error.message);
  }
}

function escapeHtml(str) {
  return str ? String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  }) : '';
}

// --- 3. Interactive Doctor Actions (API Calls) ---

// 1. "Call Next Patient" -> PATCH /api/doctor/next
async function callNextPatient() {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/next`, { method: 'PATCH' });
    const result = await response.json();
    if (!result.success) alert(result.message);
    fetchAndRenderDashboard();
  } catch (err) {
    alert('Error connecting to backend server.');
  }
}

// 2. "Mark Completed" -> PATCH /api/doctor/complete
async function markCompleted() {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/complete`, { method: 'PATCH' });
    const result = await response.json();
    if (!result.success) alert(result.message);
    fetchAndRenderDashboard();
  } catch (err) {
    alert('Error connecting to backend server.');
  }
}

// 3. "Delay Queue (+10 Mins)" -> PATCH /api/doctor/delay
async function delayQueue() {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/delay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 10 })
    });
    const result = await response.json();
    if (result.success) fetchAndRenderDashboard();
  } catch (err) {
    alert('Error connecting to backend server.');
  }
}

// 4. "Clear/Reset Queue" -> POST /api/doctor/reset
async function resetQueue() {
  if (confirm('Are you sure you want to reset all queue data in the database?')) {
    try {
      const response = await fetch(`${DOCTOR_API_URL}/reset`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        localStorage.removeItem('myToken');
        fetchAndRenderDashboard();
      }
    } catch (err) {
      alert('Error resetting database.');
    }
  }
}

// 5. Quick Add Sample Patient -> POST /api/doctor/sample
async function addSamplePatient() {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/sample`, { method: 'POST' });
    const result = await response.json();
    if (result.success) fetchAndRenderDashboard();
  } catch (err) {
    alert('Error adding sample patient.');
  }
}

// Call specific patient directly from table
window.callSpecificPatient = async function (tokenNum) {
  try {
    const response = await fetch(`${DOCTOR_API_URL}/call/${tokenNum}`, { method: 'PATCH' });
    const result = await response.json();
    if (result.success) fetchAndRenderDashboard();
  } catch (err) {
    alert('Error calling patient.');
  }
};

window.markCompleted = markCompleted;

// --- 4. Event Listeners & Real-Time Auto Sync ---
callNextBtn.addEventListener('click', callNextPatient);
markCompletedBtn.addEventListener('click', markCompleted);
delayQueueBtn.addEventListener('click', delayQueue);
resetQueueBtn.addEventListener('click', resetQueue);
addSamplePatientBtn.addEventListener('click', addSamplePatient);

document.addEventListener('DOMContentLoaded', fetchAndRenderDashboard);
setInterval(fetchAndRenderDashboard, 2000);
