/* ==========================================================================
   MEDIQ SMART QUEUE - PATIENT SIDE (FETCH API VERSION)
   ========================================================================== */

const API_BASE_URL = 'http://localhost:5000/api/appointments';

// --- 1. DOM Elements ---
const appointmentForm = document.getElementById('appointmentForm');
const bookingSection = document.getElementById('bookingSection');
const tokenSection = document.getElementById('tokenSection');
const cancelTokenBtn = document.getElementById('cancelTokenBtn');

// Placeholders on the Live Token Card
const displayTokenNumber = document.getElementById('displayTokenNumber');
const displayWaitTime = document.getElementById('displayWaitTime');
const displayPatientName = document.getElementById('displayPatientName');
const displayDoctor = document.getElementById('displayDoctor');
const displayTimeWindow = document.getElementById('displayTimeWindow');
const displayPhone = document.getElementById('displayPhone');
const displayCurrentlyServing = document.getElementById('displayCurrentlyServing');
const displayQueuePosition = document.getElementById('displayQueuePosition');
const displayStatusBadge = document.getElementById('displayStatusBadge');

// --- 2. Client-Side Session Helper ---
function getMyToken() {
  const token = localStorage.getItem('myToken');
  return token ? parseInt(token, 10) : null;
}

function setMyToken(tokenNumber) {
  localStorage.setItem('myToken', tokenNumber.toString());
}

function clearMyToken() {
  localStorage.removeItem('myToken');
}

/**
 * Formula: Wait Time = (User Token - Currently Called Token) * 15 mins + Queue Delay
 */
function calculateWaitTime(userTokenNum, currentServingNum, delayMins, status) {
  if (status === 'Completed') return 'Consultation Finished';
  if (status === 'In-Consultation' || userTokenNum === currentServingNum) {
    return '0 mins — Please enter Doctor\'s room!';
  }

  const effectiveServing = currentServingNum > 0 ? currentServingNum : 0;
  const difference = userTokenNum - effectiveServing;
  if (difference <= 0) return '0 mins (Immediate)';

  const waitMinutes = (difference * 15) + (delayMins || 0);
  return `~${waitMinutes} mins ${delayMins > 0 ? `(+${delayMins}m clinic delay)` : ''}`;
}

// --- 3. Synchronize with Backend via Fetch API ---

async function syncPatientState() {
  const myTokenNum = getMyToken();

  if (!myTokenNum) {
    bookingSection.classList.remove('hidden');
    tokenSection.classList.add('hidden');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/my-token/${myTokenNum}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      clearMyToken();
      bookingSection.classList.remove('hidden');
      tokenSection.classList.add('hidden');
      return;
    }

    const { appointment, currentlyServingToken, delayMinutes, patientsAhead } = result.data;

    // Switch view to Token Card
    bookingSection.classList.add('hidden');
    tokenSection.classList.remove('hidden');

    const formattedToken = '#' + String(appointment.tokenNumber).padStart(2, '0');
    const formattedServing = currentlyServingToken > 0 ? '#' + String(currentlyServingToken).padStart(2, '0') : 'Not Started';

    displayTokenNumber.textContent = formattedToken;
    displayPatientName.textContent = appointment.name;
    displayDoctor.textContent = appointment.doctor;
    displayTimeWindow.textContent = appointment.timeWindow;
    displayPhone.textContent = appointment.phone;
    displayCurrentlyServing.textContent = formattedServing;

    displayWaitTime.textContent = calculateWaitTime(
      appointment.tokenNumber,
      currentlyServingToken,
      delayMinutes,
      appointment.status
    );

    updateStatusBadge(appointment.status);

    if (appointment.status === 'In-Consultation') {
      displayQueuePosition.textContent = "You are currently In Consultation with the doctor!";
    } else if (appointment.status === 'Completed') {
      displayQueuePosition.textContent = "Your appointment is complete. Thank you!";
    } else if (patientsAhead === 0) {
      displayQueuePosition.textContent = "You are NEXT in line!";
    } else {
      displayQueuePosition.textContent = `${patientsAhead} patient(s) ahead of you`;
    }
  } catch (error) {
    console.warn('MediQ Backend server connection issue, retrying...', error.message);
  }
}

function updateStatusBadge(status) {
  displayStatusBadge.className = 'status-badge';
  if (status === 'In-Consultation') {
    displayStatusBadge.classList.add('status-consulting');
    displayStatusBadge.textContent = '● In Consultation';
  } else if (status === 'Completed') {
    displayStatusBadge.classList.add('status-completed');
    displayStatusBadge.textContent = '✓ Completed';
  } else {
    displayStatusBadge.classList.add('status-waiting');
    displayStatusBadge.textContent = '⏳ Waiting';
  }
}

// --- 4. Event Listeners ---

// Handle Booking Form Submit -> POST to Server
appointmentForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  const name = document.getElementById('patientName').value.trim();
  const phone = document.getElementById('phoneNumber').value.trim();
  const doctor = document.getElementById('doctorSelect').value;
  const timeWindow = document.getElementById('timeWindow').value;

  if (!name || !phone || !doctor || !timeWindow) {
    alert('Please fill out all required fields.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, doctor, timeWindow })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || 'Failed to book appointment.');
      return;
    }

    setMyToken(result.data.tokenNumber);
    syncPatientState();
  } catch (error) {
    console.error('Error connecting to MediQ backend:', error);
    alert('Unable to connect to the backend server. Please make sure the server is running on http://localhost:5000');
  }
});

// Cancel Appointment -> DELETE on Server
cancelTokenBtn.addEventListener('click', async function () {
  const myTokenNum = getMyToken();
  if (!myTokenNum) return;

  if (confirm('Are you sure you want to cancel your token and book a new appointment?')) {
    try {
      await fetch(`${API_BASE_URL}/${myTokenNum}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    clearMyToken();
    appointmentForm.reset();
    syncPatientState();
  }
});

// --- 5. Auto-Sync Loop ---
document.addEventListener('DOMContentLoaded', syncPatientState);
setInterval(syncPatientState, 2000);
