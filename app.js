// MyStudies+ PWA — με μενού προφίλ, avatar, αποσύνδεση/κλείδωμα, PIN (με fallback hash), editor & charts

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = "mystudies-data";
const PIN_KEY = "mystudies-pin";
const LOCK_KEY = "mystudies-locked";

const DEFAULT_DATA = {
  student: {
    firstName: "ΘΕΜΙΣΤΟΚΛΗΣ ΜΑΡΙΟΣ",
    lastName: "ΕΥΣΤΑΘΙΑΔΗΣ",
    university: "ΤΜΗΜΑ ΕΠΙΣΤΗΜΗΣ ΦΥΣΙΚΗΣ ΑΓΩΓΗΣ ΚΑΙ ΑΘΛΗΤΙΣΜΟΥ",
    studentId: "9980202400024",
    avatar: null
  },
  semesters: [
    {
      name: "Α’ Εξάμηνο",
      courses: [
        { title: "Διδακτική και Προπονητική Χειροσφαίρισης", grade: 1,   ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Ποδοσφαίρου",     grade: 7,   ects: 6, code: "" },
        { title: "Ιστορία Φυσικής Αγωγής και Αθλητισμού",     grade: 7,   ects: 4, code: "" },
        { title: "Διδακτική και Προπονητική Βασικής Γυμναστικής", grade: 8.5, ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Δρόμων",          grade: 7,   ects: 6, code: "" },
        { title: "Λειτουργική και Ανατομική του Ανθρώπου",     grade: 4,   ects: 6, code: "" }
      ]
    },
    {
      name: "Β’ Εξάμηνο",
      courses: [
        { title: "Οργάνωση και Διοίκηση του Αθλητισμού",      grade: 8,   ects: 4, code: "" },
        { title: "Φυσιολογία του Ανθρώπου",                   grade: 7.5, ects: 6, code: "" }
      ]
    }
  ]
};

// ---------- Utils
const toFixed2 = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));

async function hashPin(text) {
  // Προσπαθεί WebCrypto
  try {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {}
  // Fallback djb2
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return "fallback-" + (h >>> 0).toString(16);
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

async function ensureDefaultPin() {
  if (!localStorage.getItem(PIN_KEY)) {
    localStorage.setItem(PIN_KEY, await hashPin("1234"));
  }
}
function setLocked(v) { localStorage.setItem(LOCK_KEY, v ? "1" : "0"); }
function isLocked() { return localStorage.getItem(LOCK_KEY) === "1"; }

// ---------- GPA & Stats
function computeWeightedGPA(data) {
  let wsum = 0, ectsSum = 0;
  data.semesters.forEach(s => s.courses.forEach(c => {
    if (typeof c.grade === "number" && typeof c.ects === "number") {
      wsum += c.grade * c.ects; ectsSum += c.ects;
    }
  }));
  return { gpa: ectsSum ? wsum / ectsSum : null, totalECTS: ectsSum };
}
function computeSemesterStats(data) {
  const labels = [], avg = [], ectsPassed = [], ectsFailed = [], perSemester = [];
  data.semesters.forEach((s) => {
    labels.push(s.name);
    let sum = 0, cnt = 0, passed = 0, failed = 0;
    const courseLabels = [], grades = [];
    s.courses.forEach((c) => {
      const has = typeof c.grade === "number";
      const ok = has && c.grade >= 5;
      const e = typeof c.ects === "number" ? c.ects : 0;
      if (has) { sum += c.grade; cnt++; }
      if (ok) passed += e; else failed += e;
      courseLabels.push(c.title); grades.push(has ? c.grade : null);
    });
    avg.push(cnt ? sum / cnt : null); ectsPassed.push(passed); ectsFailed.push(failed);
    perSemester.push({ labels: courseLabels, grades });
  });
  return { labels, avg, ectsPassed, ectsFailed, perSemester };
}

// ---------- Rendering
function render() {
  $("#lockedCover").hidden = !isLocked();
  $("#app").style.display = isLocked() ? "none" : "";

  const data = loadData();
  renderAvatar(data.student.avatar, $("#avatarImg"), $("#avatarFallback"), data.student.firstName, data.student.lastName);
  renderAvatar(data.student.avatar, $("#menuAvatarImg"), $("#menuAvatarFallback"), data.student.firstName, data.student.lastName);
  $("#menuName").textContent = `${data.student.firstName} ${data.student.lastName}`;

  $("#fullName").textContent = `${data.student.firstName} ${data.student.lastName}`;
  $("#university").textContent = data.student.university;
  $("#studentId").textContent = `Α.Μ.: ${data.student.studentId}`;

  const { gpa, totalECTS } = computeWeightedGPA(data);
  $("#weightedGPA").textContent = toFixed2(gpa);
  $("#totalECTS").textContent = totalECTS ?? "—";

  const container = $("#semesters");
  container.innerHTML = "";
  data.semesters.forEach((sem, idx) => {
    const sec = document.createElement("section");
    sec.className = "card semester";
    sec.innerHTML = `<h2>${sem.name}</h2>`;

    sem.courses.forEach((c) => {
      const row = document.createElement("div");
      const has = typeof c.grade === "number";
      const ok = has ? c.grade >= 5 : null;
      row.className = "course";
      if (has) row.classList.add(ok ? "passed" : "failed");
      const status = has ? (ok ? "Πέρασε" : "Απέτυχε") : "—";
      row.innerHTML = `
        <div>
          <div>${c.title}</div>
          <div class="meta">${c.code || ""}</div>
        </div>
        <div class="right">
          <div class="status">${status}</div>
          <div>${toFixed2(c.grade)} • ${c.ects ?? "—"} ECTS</div>
        </div>
      `;
      sec.appendChild(row);
    });

    const block = document.createElement("div");
    block.className = "chart-block";
    block.innerHTML = `
      <h3>Βαθμοί ${sem.name}</h3>
      <canvas id="semBar-${idx}"></canvas>
    `;
    sec.appendChild(block);
    container.appendChild(sec);
  });

  renderCharts(data);
}

function renderAvatar(dataURL, imgEl, fallbackEl, fn, ln) {
  if (dataURL) {
    imgEl.src = dataURL;
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
  } else {
    const initials = `${(fn||"?")[0]||"?"}${(ln||"")[0]||""}`.toUpperCase();
    fallbackEl.textContent = initials;
    imgEl.style.display = "none";
    fallbackEl.style.display = "block";
  }
}

// ---------- PIN dialog
async function openPinDialog(mode) {
  await ensureDefaultPin();
  const dlg = $("#pinDialog");
  const title = $("#pinTitle");
  const msg = $("#pinMsg");
  const input = $("#pinInput");
  if (mode === "unlock") { title.textContent = "Είσοδος"; msg.textContent = "Δώσε PIN για πρόσβαση στην εφαρμογή."; }
  else { title.textContent = "Κρυφός Editor"; msg.textContent = "Δώσε PIN για επεξεργασία βαθμών."; }
  input.value = ""; dlg.showModal(); input.focus();

  dlg.addEventListener("close", async function onClose() {
    dlg.removeEventListener("close", onClose);
    if (dlg.returnValue === "ok") {
      const entered = await hashPin(input.value);
      const saved = localStorage.getItem(PIN_KEY);
      if (entered === saved) {
        if (mode === "unlock") { setLocked(false); render(); }
        else openEditor();
      } else { alert("Λάθος PIN."); }
    }
  });
}

// ---------- Triple tap editor
function setupTripleTap() {
  const target = $("#studentId");
  let taps = 0, timer = null;
  target.addEventListener("touchend", handle), target.addEventListener("click", handle);
  function handle() {
    taps++; if (timer) clearTimeout(timer);
    timer = setTimeout(() => { if (taps >= 3) openPinDialog("editor"); taps = 0; }, 350);
  }
}

// (Editor functions παραλείπονται εδώ για συντομία — είναι ίδια όπως στο προηγούμενο σου app.js με renderSemesterBox, collectSemestersFromUI, κτλ)

// ---------- Menu setup (ίδιο με πριν)
function setupMenu() {
  // ... ίδιος κώδικας όπως πριν για το μενού προφίλ
}

// ---------- Charts (ίδιος κώδικας όπως πριν)
function renderCharts(data) {
  // ... ίδιος κώδικας όπως πριν για τα γραφήματα
}

// ---------- Boot
document.getElementById("unlockBtn").addEventListener("click", () => openPinDialog("unlock"));
setupMenu();
setupTripleTap();
ensureDefaultPin();
if (localStorage.getItem(LOCK_KEY) == null) setLocked(false);
render();
