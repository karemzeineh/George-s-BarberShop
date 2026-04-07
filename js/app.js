/* ============================================================
   George's BarberShop — Firebase Cloud Edition
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// Notice I added 'updateDoc' to this list!
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCl9w7rVcbWsU8aDQtrfJY3LF7gRwGmN-0",
    authDomain: "georges-barbershop.firebaseapp.com",
    projectId: "georges-barbershop",
    storageBucket: "georges-barbershop.firebasestorage.app",
    messagingSenderId: "227808901339",
    appId: "1:227808901339:web:a2990497f2b298725574fe",
    measurementId: "G-N3TL2XBJ1N"
};

// 3. Start the engine
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Local state to hold our cloud data
const ACCOUNTS_KEY  = "barber_accounts"; 
const SESSION_KEY   = "barber_session";
const SCHEDULE_KEY  = "barber_schedule";

let cloudBookings = []; // This will hold live data from Firebase

// Passwords
const OWNER_PASS       = "george123";
const SUPER_ADMIN_PASS = "george456";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SERVICES = {
    "haircut": { name: "Classic Haircut", price: 70 },
    "beard":   { name: "Beard Trim & Line up", price: 40 },
    "full":    { name: "The Works (Hair + Beard)", price: 100 }
};

const DEFAULT_SCHEDULE = {
    0: { open: false, start: "09:00", end: "18:00" },
    1: { open: true,  start: "09:00", end: "18:00" },
    2: { open: true,  start: "09:00", end: "18:00" },
    3: { open: true,  start: "09:00", end: "18:00" },
    4: { open: true,  start: "09:00", end: "18:00" },
    5: { open: true,  start: "09:00", end: "14:00" },
    6: { open: false, start: "09:00", end: "18:00" },
};

// ── State ──────────────────────────────────────────────────
const state = {
    page: "auth", // auth | dashboard | client-details | time-selection | owner
    clientName: "",
    clientAge: "",
    serviceId: "haircut",
    selectedSlot: null,
};

// ── Toasts ─────────────────────────────────────────────────
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : "⚠️";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Helpers ────────────────────────────────────────────────
function getAccounts() { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); } catch { return {}; } }
function getSession() { return localStorage.getItem(SESSION_KEY); }
function setSession(phone) { localStorage.setItem(SESSION_KEY, phone); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// Function to read the live bookings array we get from the cloud
function getBookings() {
    return cloudBookings;
}

// THIS IS THE MAGIC: It listens to Firebase 24/7.
onSnapshot(collection(db, "bookings"), (snapshot) => {
    cloudBookings = []; // Clear old data
    snapshot.forEach((doc) => {
        // Grab the data and attach the special Firebase ID to it
        cloudBookings.push({ ...doc.data(), id: doc.id });
    });
    // Re-draw the screen so the owner sees the new booking pop up instantly!
    if (document.getElementById("app")) render();
});

function signUp(phone, password) {
    const accounts = getAccounts();
    if (accounts[phone]) return { ok: false, error: "Account exists. Please sign in." };
    accounts[phone] = { phone, password, name: "", age: "", createdAt: new Date().toISOString() };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    setSession(phone);
    return { ok: true };
}

function signIn(phone, password) {
    const accounts = getAccounts();
    if (!accounts[phone]) return { ok: false, error: "No account found. Sign up first." };
    if (accounts[phone].password !== password) return { ok: false, error: "Incorrect password." };
    setSession(phone);
    return { ok: true };
}

function formatPhone(raw) {
    const digits = raw.replace(/\D/g, "");
    return digits.startsWith("972") ? "0" + digits.slice(3) : digits;
}

function validatePhone(raw) {
    const n = formatPhone(raw);
    if (!/^05\d{8}$/.test(n)) return "Enter a valid 05X number.";
    return null;
}

function getFullSchedule() {
    try {
        const raw = JSON.parse(localStorage.getItem(SCHEDULE_KEY));
        if (raw) return raw;
    } catch {}
    return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
}

function updateSchedule(dayIndex, field, value) {
    let sched = getFullSchedule();
    sched[dayIndex][field] = value;
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sched));
    render();
}

function getTodaySchedule() {
    return getFullSchedule()[new Date().getDay()];
}

function generateSlots(start, end) {
    const slots = [];
    let [h, m] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    while (h < eh || (h === eh && m < em)) {
        const period = h < 12 ? "AM" : "PM";
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const dm = m === 0 ? "00" : String(m).padStart(2,"0");
        slots.push(`${dh}:${dm} ${period}`);
        m += 30; if (m >= 60) { m -= 60; h++; }
    }
    return slots;
}

// ── Icons ──────────────────────────────────────────────────
const SCISSORS = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
const USER_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

// ── Router ─────────────────────────────────────────────────
function navigate(page) { state.page = page; render(); }

function render() {
    const app = document.getElementById("app");
    const phone = getSession();
    const badge = (state.page !== "auth" && state.page !== "owner" && phone)
        ? `<div class="session-badge">🇮🇱 ${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)} <button class="signout-btn" onclick="handleSignOut()">Exit</button></div>` : "";

    let html = "";
    if (state.page === "auth") html = renderAuth();
    else if (state.page === "dashboard") html = renderDashboard();
    else if (state.page === "client-details") html = renderClientDetails();
    else if (state.page === "time-selection") html = renderTimeSelection();
    else if (state.page === "owner") html = renderOwner();

    app.innerHTML = badge + html;
}

// ── Auth ──────────────────────────────────────────────────

let _authMode = "signin";
function renderAuth() {
    return `
    <div class="page">
      <div class="container-sm fade-in">
        <div class="text-center mb-8">
          <div class="icon-circle">${SCISSORS}</div>
          <h1 class="title shimmer">George's</h1>
          <p class="subtitle">Premium cuts. Sign in to book.</p>
        </div>
        <div class="card">
          <div class="segment">
            <button class="segment-btn ${_authMode === 'signin' ? 'active' : ''}" onclick="switchAuth('signin')">Sign In</button>
            <button class="segment-btn ${_authMode === 'signup' ? 'active' : ''}" onclick="switchAuth('signup')">Sign Up</button>
          </div>
          <div class="field">
            <label class="label">Phone Number</label>
            <div class="phone-wrap">
              <span class="phone-prefix">🇮🇱 +972</span>
              <input class="phone-input" id="phone-input" type="tel" placeholder="050-000-0000" />
            </div>
          </div>
          <div class="field">
            <label class="label">Password</label>
            <input class="input" id="password-input" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')handleAuth()"/>
          </div>
          <button class="btn btn-primary" onclick="handleAuth()">${_authMode === 'signin' ? 'Sign In' : 'Create Account'}</button>
        </div>
        <button class="owner-link" onclick="navigate('owner')">Owner Login</button>
      </div>
    </div>`;
}

function switchAuth(mode) { _authMode = mode; render(); }

function handleAuth() {
    const raw = document.getElementById("phone-input").value;
    const pass = document.getElementById("password-input").value;

    const err = validatePhone(raw);
    if (err) return showToast(err, "error");
    if (!pass) return showToast("Please enter a password", "error");

    const phone = formatPhone(raw);
    const res = _authMode === "signup" ? signUp(phone, pass) : signIn(phone, pass);
    if (!res.ok) return showToast(res.error, "error");

    showToast(`Successfully signed in!`);
    navigate("dashboard");
}

function handleSignOut() { clearSession(); navigate("auth"); }

// ── Client Dashboard (Welcome Page) ────────────────────────
function renderDashboard() {
    const phone = getSession();
    const user = getAccounts()[phone] || {};
    const userBookings = getBookings().filter(b => b.phone === phone);

    let greetingName = user.name ? user.name.split(" ")[0] : "Guest";

    const bookingsHtml = userBookings.length > 0 ? userBookings.map(b => {
        const svc = SERVICES[b.serviceId] || SERVICES["haircut"];
        return `
        <div class="card glow mb-4" style="padding: 1.5rem; text-align: left;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <p class="title-md" style="color:var(--primary); margin:0;">${b.time}</p>
                <button class="btn-outline" style="width:auto; padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="cancelMyBooking('${b.time}')">Cancel</button>
            </div>
            <hr class="divider" style="margin: 0.75rem 0;">
            <p style="font-weight:600;font-size:1.1rem">${svc.name}</p>
            <p class="subtitle">Estimated: ₪${svc.price}</p>
        </div>`;
    }).join("") : `
        <div class="card mb-6 text-center" style="border-style: dashed; background: transparent;">
            <p class="subtitle">You have no upcoming appointments.</p>
        </div>
    `;

    return `
    <div class="page top">
      <div class="container-sm text-center fade-in">
        
        <div class="mt-4 mb-8">
            <div class="icon-circle lg mb-4">${USER_ICON}</div>
            <h1 class="title-lg shimmer mb-1">Welcome, ${greetingName}!</h1>
            <p class="subtitle">Manage your profile and appointments.</p>
        </div>

        <div style="display:flex; gap:0.75rem; margin-bottom:2.5rem;">
            <button class="btn btn-primary" onclick="navigate('client-details')" style="flex:2;">+ Book Appointment</button>
            <button class="btn btn-outline" onclick="navigate('client-details')" style="flex:1;">Edit Profile</button>
        </div>

        <div style="text-align:left;">
            <h2 class="title-md mb-4">Your Schedule</h2>
            ${bookingsHtml}
        </div>

      </div>
    </div>`;
}

// ── FIXED: Cancel Booking in Cloud ──
async function cancelMyBooking(time) {
    if(!confirm("Are you sure you want to cancel this appointment?")) return;
    
    // Find the exact booking ID from Firebase
    const targetBooking = getBookings().find(x => x.time === time);
    
    if (targetBooking && targetBooking.id) {
        try {
            await deleteDoc(doc(db, "bookings", targetBooking.id));
            showToast("Appointment cancelled.");
        } catch (error) {
            console.error(error);
            showToast("Failed to cancel.", "error");
        }
    }
}

// ── Profile & Service Selection ────────────────────────────
function renderClientDetails() {
    const phone = getSession();
    const user = getAccounts()[phone] || {};

    if (!state.clientName && user.name) state.clientName = user.name;
    if (!state.clientAge && user.age) state.clientAge = user.age;

    const svcOptions = Object.entries(SERVICES).map(([id, s]) =>
        `<option value="${id}" ${state.serviceId === id ? "selected" : ""}>${s.name} — ₪${s.price}</option>`
    ).join("");

    return `
    <div class="page top">
      <div class="container fade-in">
        <button class="btn-outline mb-6 mt-4" style="width:auto;padding:0.5rem 1rem" onclick="navigate('dashboard')">&larr; Dashboard</button>
        
        <h1 class="title-md mb-6">Profile & Details</h1>
        <div class="card">
          <div class="field">
            <label class="label">Full Name</label>
            <input class="input" id="cd-name" value="${state.clientName}" placeholder="Karem" />
          </div>
          <div class="field">
            <label class="label">Age</label>
            <input class="input" id="cd-age" type="number" value="${state.clientAge}" placeholder="19" />
          </div>
          <div class="field">
            <label class="label">Service Required</label>
            <select class="select" id="cd-service">${svcOptions}</select>
          </div>
          
          <button class="btn btn-primary mt-6 mb-4" onclick="handleDetails('time')">Save & Pick a Time &rarr;</button>
          <button class="btn btn-outline" onclick="handleDetails('save')">Just Save Profile</button>
        </div>
      </div>
    </div>`;
}

// ── FIXED: Update Profile in Cloud ──
async function handleDetails(action) {
    const n = document.getElementById("cd-name").value.trim();
    const a = document.getElementById("cd-age").value.trim();
    const s = document.getElementById("cd-service").value;

    if (!n || !a) return showToast("Please fill in your name and age.", "error");

    state.clientName = n; state.clientAge = a; state.serviceId = s;

    const phone = getSession();
    const accounts = getAccounts();

    if(accounts[phone]) {
        accounts[phone].name = n;
        accounts[phone].age = a;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    // Update ALL existing bookings for this user in Firebase so their name changes everywhere
    const bookings = getBookings();
    for (const b of bookings) {
        if(b.phone === phone && b.id) {
            try {
                await updateDoc(doc(db, "bookings", b.id), {
                    name: n,
                    age: a
                });
            } catch (err) {
                console.error(err);
            }
        }
    }

    showToast("Profile Saved!");

    if (action === 'time') {
        navigate("time-selection");
    } else {
        navigate("dashboard");
    }
}

// ── Time Selection ─────────────────────────────────────────
function renderTimeSelection() {
    const today = getTodaySchedule();
    if (!today.open) return `<div class="page"><div class="container text-center fade-in"><h2 class="title-md">Closed Today</h2><button class="btn btn-outline mt-6" onclick="navigate('client-details')">Back</button></div></div>`;

    const slots = generateSlots(today.start, today.end);
    const booked = getBookings().map(b => b.time);

    let allowedSlots = slots;
    if (booked.length > 0) {
        const bookedIndices = slots.map((s, i) => booked.includes(s) ? i : -1).filter(i => i !== -1);
        allowedSlots = slots.filter((s, i) => {
            if (booked.includes(s)) return true;
            return bookedIndices.some(bi => Math.abs(bi - i) <= 2);
        });
    }

    const btns = allowedSlots.map(s => {
        const isB = booked.includes(s);
        const cls = isB ? "slot-btn booked" : (state.selectedSlot === s ? "slot-btn selected" : "slot-btn");
        return `<button class="${cls}" ${isB ? "" : `onclick="state.selectedSlot='${s}';render()"`}>${s}</button>`;
    }).join("");

    return `
    <div class="page top">
      <div class="container fade-in">
        <button class="btn-outline mb-6 mt-4" style="width:auto;padding:0.5rem 1rem" onclick="navigate('client-details')">&larr; Back</button>
        <h2 class="title-md mb-2">Select a Time</h2>
        <p class="subtitle mb-6">${SERVICES[state.serviceId].name} (₪${SERVICES[state.serviceId].price})</p>
        
        <div class="slot-grid">${btns}</div>
        
        <button class="btn btn-primary" onclick="confirmBooking()" ${!state.selectedSlot ? "disabled" : ""}>
          Confirm ${state.selectedSlot || ""}
        </button>

        <div class="card glow mt-6 text-center" style="padding: 1.5rem;">
          <p class="subtitle" style="font-size:0.85rem; margin-bottom:0.25rem;">Can't find a suitable time?</p>
          <p class="title-md" style="font-size:1.1rem">Call: <a href="tel:0542118873" style="color:var(--primary);text-decoration:none;">0542118873</a></p>
        </div>
      </div>
    </div>`;
}

async function confirmBooking() {
    if (!state.selectedSlot) return;
    const b = getBookings();

    if(b.find(x => x.time === state.selectedSlot)) {
        return showToast("Sorry, this slot just got taken!", "error");
    }

    // Tell Firebase to save this to the cloud!
    try {
        await addDoc(collection(db, "bookings"), {
            time: state.selectedSlot,
            name: state.clientName,
            age: state.clientAge,
            phone: getSession(),
            serviceId: state.serviceId,
            date: new Date().toISOString()
        });

        showToast("Booking Confirmed! 🎉");
        state.selectedSlot = null;
        navigate("dashboard");
    } catch (e) {
        console.error("Error adding document: ", e);
        showToast("Error connecting to database.", "error");
    }
}

// ── Owner Panel ────────────────────────────────────────────
let _ownerAuthed = false;
function renderOwner() {
    if (!_ownerAuthed) {
        return `
        <div class="page">
          <div class="container-sm fade-in">
            <button class="btn-outline mb-6" style="width:auto;padding:0.5rem 1rem" onclick="navigate('auth')">&larr; Back</button>
            <div class="card">
              <h2 class="title-md mb-4 text-center">Owner Login</h2>
              <input class="input mb-4" id="ow-pw" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')loginOwner()"/>
              <button class="btn btn-primary" onclick="loginOwner()">Access Dashboard</button>
            </div>
          </div>
        </div>`;
    }

    const b = getBookings();
    const totalRev = b.reduce((sum, appt) => sum + (SERVICES[appt.serviceId]?.price || 0), 0);

    const list = b.length ? b.map(x => `
      <div class="booking-item">
        <div>
          <div class="booking-time">${x.time}</div>
          <div class="booking-details">${x.name} (${x.phone})</div>
          <div class="booking-service">${SERVICES[x.serviceId]?.name || 'Service'}</div>
        </div>
        <button class="btn-outline" style="width:auto;padding:0.4rem 0.8rem;font-size:0.8rem" onclick="ownerDelete('${x.time}')">Remove</button>
      </div>
    `).join("") : `<p class="subtitle text-center">No bookings today.</p>`;

    const accounts = getAccounts();
    const accountHtmlList = Object.keys(accounts).length ? Object.values(accounts).map(acc => `
      <div class="booking-item">
        <div>
          <div class="booking-time" style="font-size:1rem; color:var(--fg);">${acc.name || 'No Name Set'}</div>
          <div class="booking-details" style="color:var(--fg-muted);">${acc.phone}</div>
        </div>
        <button class="btn-danger" style="width:auto;padding:0.4rem 0.8rem;font-size:0.8rem; border-radius:0.5rem;" onclick="adminDeleteAccount('${acc.phone}')">Delete User</button>
      </div>
    `).join("") : `<p class="subtitle text-center">No accounts registered.</p>`;

    const sched = getFullSchedule();
    const schedHtml = DAY_NAMES.map((day, i) => `
      <div class="booking-item" style="flex-direction: column; align-items: flex-start; gap: 0.75rem;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
              <span style="font-weight:600">${day}</span>
              <label class="switch">
                  <input type="checkbox" ${sched[i].open ? "checked" : ""} onchange="updateSchedule(${i}, 'open', this.checked)">
                  <span class="slider"></span>
              </label>
          </div>
          <div style="display:flex; gap: 1rem; width:100%; ${!sched[i].open ? 'opacity:0.3; pointer-events:none;' : ''}">
              <div class="field mb-0" style="flex:1; margin-bottom:0;">
                  <label class="label" style="font-size:0.7rem">Open</label>
                  <input class="input" type="time" value="${sched[i].start}" onchange="updateSchedule(${i}, 'start', this.value)" style="padding:0.5rem">
              </div>
              <div class="field mb-0" style="flex:1; margin-bottom:0;">
                  <label class="label" style="font-size:0.7rem">Close</label>
                  <input class="input" type="time" value="${sched[i].end}" onchange="updateSchedule(${i}, 'end', this.value)" style="padding:0.5rem">
              </div>
          </div>
      </div>
    `).join("");

    return `
    <div class="page top">
      <div class="container-lg fade-in">
        <div style="display:flex;justify-content:space-between;align-items:center" class="mb-6 mt-4">
            <h1 class="title-md shimmer">Dashboard</h1>
            <button class="btn-outline" style="width:auto;padding:0.5rem 1rem" onclick="exitOwner()">Exit</button>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${b.length}</div>
                <div class="stat-label">Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">₪${totalRev}</div>
                <div class="stat-label">Est. Revenue</div>
            </div>
        </div>

        <h2 class="title-md mb-4 mt-6">Shop Schedule</h2>
        <div class="schedule-list mb-6">
            ${schedHtml}
        </div>

        <h2 class="title-md mb-4 mt-6">Today's Bookings</h2>
        ${list}
        <button class="btn btn-danger mt-6 mb-8" onclick="ownerClearAll()">Clear All Bookings</button>
        <hr class="divider">

        <h2 class="title-md mb-4 mt-6">Client Accounts</h2>
        <p class="subtitle mb-4">Requires Super Admin password to delete.</p>
        <div class="schedule-list mb-6">
            ${accountHtmlList}
        </div>
        <button class="btn btn-danger mt-6" style="background: #7f1d1d; border-color: #ef4443;" onclick="wipeAllData()">FACTORY RESET APP</button>
      </div>
    </div>`;
}

function loginOwner() {
    if (document.getElementById("ow-pw").value === OWNER_PASS) { _ownerAuthed = true; render(); }
    else showToast("Incorrect password", "error");
}

// ── FIXED: Owner Delete Specific Booking in Cloud ──
async function ownerDelete(time) {
    if(!confirm(`Remove appointment at ${time}?`)) return;
    
    const targetBooking = getBookings().find(x => x.time === time);
    if (targetBooking && targetBooking.id) {
        try {
            await deleteDoc(doc(db, "bookings", targetBooking.id));
            showToast("Removed", "success");
        } catch(err) {
            console.error(err);
            showToast("Failed to remove.", "error");
        }
    }
}

// ── FIXED: Owner Clear All Bookings in Cloud ──
async function ownerClearAll() {
    if(!confirm("DELETE ALL BOOKINGS? This cannot be undone.")) return;
    
    const bookings = getBookings();
    for (const b of bookings) {
        if (b.id) {
            try {
                await deleteDoc(doc(db, "bookings", b.id));
            } catch(err) {
                console.error("Failed to delete doc", err);
            }
        }
    }
    showToast("Schedule Cleared");
}

// ── FIXED: Super Admin Delete Account & Cloud Bookings ──
async function adminDeleteAccount(phone) {
    const adminAttempt = prompt("Enter Super Admin password to delete this account:");
    if (adminAttempt !== SUPER_ADMIN_PASS) return showToast("Incorrect admin password. Deletion canceled.", "error");

    if(!confirm(`Are you absolutely sure you want to delete the account and bookings for ${phone}?`)) return;

    // 1. Delete the local account
    const accounts = getAccounts();
    delete accounts[phone];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    // 2. Delete all their bookings from Firebase
    const bookings = getBookings();
    for (const b of bookings) {
        if (b.phone === phone && b.id) {
            try {
                await deleteDoc(doc(db, "bookings", b.id));
            } catch(err) {
                console.error(err);
            }
        }
    }

    if (getSession() === phone) clearSession();

    showToast("Account completely removed.", "success");
    render();
}

function wipeAllData() {
    const adminAttempt = prompt("Enter Super Admin password to factory reset:");
    if (adminAttempt !== SUPER_ADMIN_PASS) return showToast("Incorrect admin password.", "error");

    if(!confirm("WARNING: This will delete ALL accounts, bookings, and custom schedules. Are you sure?")) return;

    localStorage.clear();
    ownerClearAll(); // Clear Firebase too
    showToast("All data wiped completely.", "success");

    setTimeout(() => { window.location.reload(); }, 1500);
}

function exitOwner() { _ownerAuthed = false; navigate("auth"); }

// ── Init ───────────────────────────────────────────────────
state.page = getSession() ? "dashboard" : "auth";
render();

// ── EXPORT FUNCTIONS TO GLOBAL WINDOW (Because of type="module") ──
window.state = state;               // <-- ADDED THIS
window.render = render;             // <-- ADDED THIS
window.switchAuth = switchAuth;
window.handleAuth = handleAuth;
window.navigate = navigate;
window.handleSignOut = handleSignOut;
window.cancelMyBooking = cancelMyBooking;
window.handleDetails = handleDetails;
window.confirmBooking = confirmBooking;
window.loginOwner = loginOwner;
window.ownerDelete = ownerDelete;
window.ownerClearAll = ownerClearAll;
window.adminDeleteAccount = adminDeleteAccount;
window.wipeAllData = wipeAllData;
window.exitOwner = exitOwner;
window.updateSchedule = updateSchedule;
