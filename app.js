
"use strict";

/* ==========================================
   ESR AUDIT CAPTURE - MOCK-UP VERSION
========================================== */

const STORAGE_KEY = "esr-audit-draft-v2";
const DB_NAME = "esr-audit-photos-v2";

/* HARDCODED OFFICER ASSIGNMENTS */

const ASSIGNMENTS = {
  "Officer A": {
    am: "ABC Coffee Shop",
    pm: "Habibi Coffee Shop"
  },
  "Officer B": {
    am: "XYZ Eatery",
    pm: "Mala House"
  },
  "Officer C": {
    am: "Sunrise Coffee Shop",
    pm: "Golden Wok Eatery"
  }
};

/* AUDIT SECTIONS */

const SECTION_CONFIG = [
  {
    id: "cubicles",
    name: "Cubicles",
    onionSkin: "IMG-20260930-WA0009.jpg",
    help: "Overview: show the cubicle area. Close-up: show one toilet bowl or squat pan."
  },
  {
    id: "general",
    name: "General Area",
    onionSkin: "assets/2.png",
    help: "Overview: show the general floor. Close-up: show the relevant floor condition."
  },
  {
    id: "sink",
    name: "Sink Area",
    onionSkin: "assets/3.png",
    help: "Overview: show the sink area. Close-up: show the basin and vanity."
  },
  {
    id: "urinal",
    name: "Urinal Area",
    onionSkin: "assets/4.png",
    help: "Overview: show the urinal area. Close-up: show one urinal, including its outlet."
  },
  {
    id: "misc",
    name: "Miscellaneous",
    onionSkin: "assets/5.png",
    help: "Overview: show the miscellaneous area. Close-up: show the litter bin or amenity."
  }
];

/* STATE */

const state = {
  officer: "",
  premiseChoice: "",
  otherPremise: "",
  auditStartedAt: null,
  location: null,
  initialLocation: null,
  selfie: null,
  device: {},
  sections: Object.fromEntries(
    SECTION_CONFIG.map(s => [
      s.id,
      { overview: null, closeup: null }
    ])
  ),
  selfieStream: null,
  auditStream: null,
  activeCapture: null,
  setupWasComplete: false
};

const $ = id => document.getElementById(id);

/* ELEMENTS */

const officerSelect = $("officerSelect");
const assignmentDetails = $("assignmentDetails");
const auditDateTime = $("auditDateTime");
const amPremiseName = $("amPremiseName");
const pmPremiseName = $("pmPremiseName");
const otherPremiseGroup = $("otherPremiseGroup");
const otherPremiseInput = $("otherPremiseInput");

const setupCard = $("setupCard");
const setupToggleBtn = $("setupToggleBtn");
const setupStatus = $("setupStatus");

const locationBtn = $("locationBtn");
const locationStatus = $("locationStatus");
const locationDetails = $("locationDetails");
const deviceStatus = $("deviceStatus");

const selfieCard = $("selfieCard");
const selfieToggleBtn = $("selfieToggleBtn");
const selfieStatus = $("selfieStatus");
const startSelfieBtn = $("startSelfieBtn");
const captureSelfieBtn = $("captureSelfieBtn");
const selfiePreview = $("selfiePreview");

const camera = $("camera");
const auditCamera = $("auditCamera");
const captureCanvas = $("captureCanvas");
const auditCanvas = $("auditCanvas");

const sectionsContainer = $("sectionsContainer");
const template = $("sectionTemplate");
const captureDialog = $("captureDialog");
const dialogTitle = $("dialogTitle");
const dialogHint = $("dialogHint");
const auditOnionSkin = $("auditOnionSkin");
const qualityMessage = $("qualityMessage");
const captureAuditBtn = $("captureAuditBtn");
const closeDialogBtn = $("closeDialogBtn");

const completionSummary = $("completionSummary");
const downloadBtn = $("downloadBtn");
const resetBtn = $("resetBtn");

/* ==========================================
   BROWSER STORAGE
========================================== */

function saveDraft() {
  const draft = {
    officer: state.officer,
    premiseChoice: state.premiseChoice,
    otherPremise: state.otherPremise,
    auditStartedAt: state.auditStartedAt,
    location: state.location,
    initialLocation: state.initialLocation
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(draft)
    );
  } catch (err) {
    console.warn("Form draft could not be saved:", err);
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);

    state.officer = saved.officer || "";
    state.premiseChoice = saved.premiseChoice || "";
    state.otherPremise = saved.otherPremise || "";
    state.auditStartedAt = saved.auditStartedAt || null;
    state.location = saved.location || null;
    state.initialLocation = saved.initialLocation || null;

  } catch (err) {
    console.warn("Form draft could not be restored:", err);
  }
}

/* IndexedDB stores photographs separately.
   This avoids localStorage's small storage limit. */

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", {
          keyPath: "id"
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePhoto(id, record) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");

    tx.objectStore("photos").put({
      id,
      record
    });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function restorePhotos() {
  try {
    const db = await openPhotoDB();

    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction("photos", "readonly");
      const req = tx.objectStore("photos").getAll();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    db.close();

    for (const row of rows) {
      if (row.id === "selfie") {
        state.selfie = row.record;
        continue;
      }

      const [sectionId, shot] = row.id.split(":");

      if (
        state.sections[sectionId] &&
        ["overview", "closeup"].includes(shot)
      ) {
        state.sections[sectionId][shot] = row.record;
      }
    }

  } catch (err) {
    console.warn("Photos could not be restored:", err);
  }
}

async function clearPhotos() {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");

    tx.objectStore("photos").clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/* ==========================================
   DATE, TIME AND ASSIGNMENTS
========================================== */

function singaporeHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      hourCycle: "h23"
    }).format(new Date())
  );
}

function updateClock() {
  if (!state.officer) return;

  auditDateTime.value = new Intl.DateTimeFormat(
    "en-SG",
    {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Singapore"
    }
  ).format(new Date());
}

function getPremise() {
  if (state.premiseChoice === "other") {
    return state.otherPremise.trim();
  }

  return ASSIGNMENTS[state.officer]?.[
    state.premiseChoice
  ] || "";
}

function updateAssignmentDisplay() {
  const officer = state.officer;

  assignmentDetails.hidden = !officer;

  if (!officer) return;

  const assigned = ASSIGNMENTS[officer];

  amPremiseName.textContent = assigned.am;
  pmPremiseName.textContent = assigned.pm;

  document.querySelectorAll(
    'input[name="premiseChoice"]'
  ).forEach(radio => {
    radio.checked =
      radio.value === state.premiseChoice;
  });

  otherPremiseGroup.hidden =
    state.premiseChoice !== "other";

  otherPremiseInput.value = state.otherPremise;

  updateClock();
}

officerSelect.addEventListener("change", () => {
  const previousOfficer = state.officer;
  state.officer = officerSelect.value;

  if (previousOfficer !== state.officer) {
    // New officer selection defaults to current AM/PM.
    state.premiseChoice =
      singaporeHour() < 12 ? "am" : "pm";

    state.otherPremise = "";
  }

  if (state.officer && !state.auditStartedAt) {
    state.auditStartedAt = new Date().toISOString();
  }

  updateAssignmentDisplay();
  saveDraft();
  updateCompletion();
});

document.querySelectorAll(
  'input[name="premiseChoice"]'
).forEach(radio => {
  radio.addEventListener("change", () => {
    state.premiseChoice = radio.value;

    otherPremiseGroup.hidden =
      radio.value !== "other";

    saveDraft();
    updateCompletion();
  });
});

otherPremiseInput.addEventListener("input", () => {
  state.otherPremise = otherPremiseInput.value;
  saveDraft();
  updateCompletion();
});

/* ==========================================
   LOCATION
========================================== */

function validLocation(loc) {
  return Boolean(
    loc &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
  );
}

function positionRecord(pos) {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyM: Math.round(pos.coords.accuracy),
    altitude: pos.coords.altitude,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    capturedAt: new Date(pos.timestamp).toISOString()
  };
}

function getFreshLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve(positionRecord(pos)),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

function updateLocationDisplay() {
  if (validLocation(state.location)) {
    locationStatus.textContent = "Location ready";
    locationStatus.className = "badge good";

    locationDetails.textContent =
      `Accuracy: ±${state.location.accuracyM} m · ` +
      `Captured: ${new Date(
        state.location.capturedAt
      ).toLocaleString("en-SG", {
        timeZone: "Asia/Singapore"
      })}`;

  } else {
    locationStatus.textContent = "Not captured";
    locationStatus.className = "badge bad";

    locationDetails.textContent =
      "Location is required before continuing.";
  }
}

locationBtn.addEventListener("click", async () => {
  if (!state.officer) {
    alert("Select the audit officer first.");
    return;
  }

  locationBtn.disabled = true;
  locationStatus.textContent = "Locating…";
  locationStatus.className = "badge bad";

  const loc = await getFreshLocation();

  locationBtn.disabled = false;

  if (!validLocation(loc)) {
    if (!validLocation(state.location)) {
      locationStatus.textContent = "Unavailable";
      locationStatus.className = "badge bad";
    }

    locationDetails.textContent =
      "Could not obtain GPS location. Check permissions and try again.";
    return;
  }

  state.location = loc;

  if (!state.initialLocation) {
    state.initialLocation = { ...loc };
  }

  updateLocationDisplay();
  saveDraft();
  updateCompletion();
});

/* ==========================================
   DEVICE
========================================== */

function detectDevice() {
  const ua = navigator.userAgent || "Unknown";

  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    "Unknown";

  const mobile =
    navigator.userAgentData?.mobile ??
    /Android|iPhone|iPad|Mobile/i.test(ua);

  state.device = {
    platform,
    mobile,
    userAgent: ua,
    screen: `${screen.width}x${screen.height}`,
    pixelRatio: window.devicePixelRatio || 1
  };

  deviceStatus.textContent =
    `${platform}${mobile ? " · mobile" : ""}`;
}

/* ==========================================
   COLLAPSIBLE SECTIONS
========================================== */

function toggleCard(card, button) {
  const collapsed = card.classList.toggle("collapsed");

  button.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );
}

function collapseCard(card, button) {
  card.classList.add("collapsed");
  button.setAttribute("aria-expanded", "false");
}

setupToggleBtn.addEventListener("click", () => {
  toggleCard(setupCard, setupToggleBtn);
});

selfieToggleBtn.addEventListener("click", () => {
  toggleCard(selfieCard, selfieToggleBtn);
});

/* ==========================================
   CAMERA HELPERS
========================================== */

async function stopStream(stream) {
  if (!stream) return;

  stream.getTracks().forEach(track => track.stop());
}

async function startCamera(video, facingMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API unavailable. Use HTTPS.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1440 }
    },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  return stream;
}

function captureFrame(video, canvas) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    dataUrl: canvas.toDataURL("image/jpeg", 0.85)
  };
}

function assessImageQuality(canvas) {
  const sample = document.createElement("canvas");
  sample.width = 200;
  sample.height = 150;

  const ctx = sample.getContext("2d");
  ctx.drawImage(canvas, 0, 0, 200, 150);

  const data = ctx.getImageData(0, 0, 200, 150).data;

  let sum = 0;
  let sumSq = 0;

  const gray = new Float32Array(200 * 150);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    gray[p] = g;
    sum += g;
    sumSq += g * g;
  }

  const mean = sum / gray.length;
  const variance = sumSq / gray.length - mean * mean;

  let edges = 0;
  let count = 0;

  for (let y = 1; y < 149; y += 2) {
    for (let x = 1; x < 199; x += 2) {
      const i = y * 200 + x;

      edges += Math.abs(
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - 200] -
        gray[i + 200]
      );

      count++;
    }
  }

  const sharpness = edges / Math.max(count, 1);

  if (mean < 35) {
    return { accept: false, reason: "Image too dark" };
  }

  if (mean > 235) {
    return { accept: false, reason: "Image overexposed" };
  }

  if (variance < 180) {
    return { accept: false, reason: "Image contrast too low" };
  }

  if (sharpness < 7) {
    return { accept: false, reason: "Image appears blurry" };
  }

  return {
    accept: true,
    reason: "Basic image checks passed",
    brightness: mean,
    contrast: variance,
    sharpness
  };
}

function captureRecord(dataUrl, section, shot, quality) {
  return {
    section,
    shot,
    imageDataUrl: dataUrl,
    capturedAt: new Date().toISOString(),
    officer: state.officer,
    premise: getPremise(),
    location: { ...state.location },
    device: { ...state.device },
    quality
  };
}

/* ==========================================
   SECTION 2: SELFIE
========================================== */

startSelfieBtn.addEventListener("click", async () => {
  if (!isSetupComplete()) {
    alert("Complete officer, premise and GPS first.");
    return;
  }

  await stopStream(state.selfieStream);

  try {
    state.selfieStream = await startCamera(camera, "user");
    captureSelfieBtn.disabled = false;

  } catch (err) {
    alert(`Front camera unavailable: ${err.message}`);
  }
});

captureSelfieBtn.addEventListener("click", async () => {
  try {
    if (!isSetupComplete()) {
      alert("Audit details and GPS are required.");
      return;
    }

    const shot = captureFrame(camera, captureCanvas);
    const quality = assessImageQuality(shot.canvas);

    if (!quality.accept) {
      alert(`Retake selfie: ${quality.reason}`);
      return;
    }

    const record = captureRecord(
      shot.dataUrl,
      "selfie",
      "selfie",
      quality
    );

    // Save the image before marking capture complete.
    await savePhoto("selfie", record);

    state.selfie = record;

    selfiePreview.innerHTML =
      `<img src="${shot.dataUrl}" alt="Officer selfie">`;

    selfieStatus.textContent = "Completed";
    startSelfieBtn.textContent = "Retake selfie";

    await stopStream(state.selfieStream);
    state.selfieStream = null;
    camera.srcObject = null;
    captureSelfieBtn.disabled = true;

    collapseCard(selfieCard, selfieToggleBtn);
    updateCompletion();

  } catch (err) {
    alert(`Selfie could not be saved: ${err.message}`);
  }
});

/* ==========================================
   SECTION 3: AUDIT PHOTOS
========================================== */

function renderSections() {
  sectionsContainer.innerHTML = "";

  for (const section of SECTION_CONFIG) {
    const fragment = template.content.cloneNode(true);
    const article = fragment.querySelector(".audit-section");

    article.dataset.section = section.id;
    article.querySelector("h3").textContent = section.name;
    article.querySelector(".section-help").textContent =
      section.help;

    const toggle = article.querySelector(
      ".section-toggle-btn"
    );

    toggle.addEventListener("click", () => {
      toggleCard(article, toggle);
    });

    article.querySelectorAll(".capture-item")
      .forEach(item => {
        const shot = item.dataset.shot;

        item.querySelector(".capture-shot-btn")
          .addEventListener("click", () => {
            openAuditCapture(section.id, shot);
          });
      });

    sectionsContainer.appendChild(fragment);
  }
}

async function openAuditCapture(sectionId, shot) {
  if (!isSetupComplete()) {
    alert("Officer, premise and GPS are required.");
    return;
  }

  if (!state.selfie) {
    alert("Take the officer selfie first.");
    return;
  }

  const section = SECTION_CONFIG.find(
    s => s.id === sectionId
  );

  state.activeCapture = { sectionId, shot };

  dialogTitle.textContent =
    `${section.name} - ${shot === "overview" ?
      "Overview" : "Close-up"}`;

  dialogHint.textContent = section.help;

  qualityMessage.textContent =
    "Align the live camera with the reference image.";

  qualityMessage.className = "quality-message";

  auditOnionSkin.onerror = () => {
    qualityMessage.textContent =
      "Reference image unavailable. Camera capture can continue.";
    qualityMessage.className = "quality-message warn";
  };

  auditOnionSkin.src = section.onionSkin;

  captureDialog.showModal();

  try {
    state.auditStream =
      await startCamera(auditCamera, "environment");

  } catch (err) {
    alert(`Rear camera unavailable: ${err.message}`);
    closeCaptureDialog();
  }
}

async function closeCaptureDialog() {
  await stopStream(state.auditStream);

  state.auditStream = null;
  auditCamera.srcObject = null;
  state.activeCapture = null;

  if (captureDialog.open) captureDialog.close();
}

closeDialogBtn.addEventListener(
  "click",
  closeCaptureDialog
);

captureDialog.addEventListener("cancel", e => {
  e.preventDefault();
  closeCaptureDialog();
});

captureAuditBtn.addEventListener("click", async () => {
  if (!state.activeCapture) return;

  captureAuditBtn.disabled = true;

  try {
    const loc = await getFreshLocation();

    if (!validLocation(loc)) {
      qualityMessage.textContent =
        "Rejected: fresh GPS fix unavailable.";
      qualityMessage.className = "quality-message warn";
      return;
    }

    state.location = loc;
    updateLocationDisplay();
    saveDraft();

    const shot = captureFrame(auditCamera, auditCanvas);
    const quality = assessImageQuality(shot.canvas);

    if (!quality.accept) {
      qualityMessage.textContent =
        `Rejected: ${quality.reason}`;
      qualityMessage.className = "quality-message warn";
      return;
    }

    const { sectionId, shot: shotType } =
      state.activeCapture;

    const record = captureRecord(
      shot.dataUrl,
      sectionId,
      shotType,
      quality
    );

    await savePhoto(
      `${sectionId}:${shotType}`,
      record
    );

    state.sections[sectionId][shotType] = record;

    refreshSectionUI(sectionId);
    await closeCaptureDialog();
    updateCompletion();

  } catch (err) {
    qualityMessage.textContent =
      `Capture could not be saved: ${err.message}`;
    qualityMessage.className = "quality-message warn";

  } finally {
    captureAuditBtn.disabled = false;
  }
});

function refreshSectionUI(sectionId, autoCollapse = true) {
  const article = document.querySelector(
    `.audit-section[data-section="${sectionId}"]`
  );

  if (!article) return;

  let count = 0;

  for (const shot of ["overview", "closeup"]) {
    const item = article.querySelector(
      `.capture-item[data-shot="${shot}"]`
    );

    const preview = item.querySelector(".mini-preview");
    const button = item.querySelector(".capture-shot-btn");
    const record = state.sections[sectionId][shot];

    if (record) {
      count++;

      preview.innerHTML =
        `<img src="${record.imageDataUrl}" alt="${shot}">`;

      button.textContent = `Retake ${shot}`;

    } else {
      preview.innerHTML = "";
      button.textContent = `Take ${shot}`;
    }
  }

  article.querySelector(".section-progress").textContent =
    `${count}/2`;

  if (count === 2 && autoCollapse) {
    collapseCard(
      article,
      article.querySelector(".section-toggle-btn")
    );
  }
}

/* ==========================================
   COMPLETION
========================================== */

function isSetupComplete() {
  return Boolean(
    state.officer &&
    getPremise() &&
    validLocation(state.location)
  );
}

function updateCompletion() {
  const complete = isSetupComplete();

  setupStatus.textContent =
    complete ? "Completed" : "Not completed";

  // Collapse on first completion only.
  // Do not interrupt manual editing.
  if (complete && !state.setupWasComplete) {
    collapseCard(setupCard, setupToggleBtn);
  }

  state.setupWasComplete = complete;

  const missing = [];

  if (!state.officer) missing.push("officer");
  if (!getPremise()) missing.push("premise");
  if (!validLocation(state.location)) missing.push("GPS");
  if (!state.selfie) missing.push("selfie");

  let photoCount = 0;

  for (const section of SECTION_CONFIG) {
    if (state.sections[section.id].overview) photoCount++;
    if (state.sections[section.id].closeup) photoCount++;
  }

  if (photoCount < 10) {
    missing.push(`${10 - photoCount} audit photographs`);
  }

  if (missing.length) {
    completionSummary.textContent =
      `Not ready. Missing: ${missing.join(", ")}.`;

    downloadBtn.disabled = true;

  } else {
    completionSummary.textContent =
      `Ready to export.\n` +
      `Officer: ${officerSelect.selectedOptions[0].text}\n` +
      `Premise: ${getPremise()}\n` +
      `Photos: ${photoCount}/10\n` +
      `GPS: Captured`;

    downloadBtn.disabled = false;
  }
}

/* ==========================================
   JSON EXPORT
========================================== */

downloadBtn.addEventListener("click", async () => {
  updateCompletion();
  if (downloadBtn.disabled) return;

  const auditId =
    crypto.randomUUID?.() || `audit-${Date.now()}`;

  const data = {
    schemaVersion: "2.0",
    auditId,
    exportedAt: new Date().toISOString(),

    officer: {
      id: state.officer,
      name: officerSelect.selectedOptions[0].text
    },

    premise: {
      name: getPremise(),
      selection: state.premiseChoice,
      assignmentSource: "Mock-up"
    },

    auditStartedAt: state.auditStartedAt,
    device: state.device,
    initialLocation: state.initialLocation,
    latestLocation: state.location,
    selfie: state.selfie,
    sections: state.sections,

    notes: {
      capture: "Browser live camera",
      persistence: "Local browser storage",
      limitations: [
        "Browser GPS and device clocks are not tamper-proof.",
        "No server-side verification or central storage.",
        "Photo checks assess basic visual quality, not fixture identity.",
        "This mock-up does not calculate TCI or determine ESR enforcement outcomes."
      ]
    }
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `${sanitizeFilename(getPremise())}-audit.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function sanitizeFilename(text) {
  return (text || "premise")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .slice(0, 80);
}

/* ==========================================
   RESET
========================================== */

resetBtn.addEventListener("click", async () => {
  if (!confirm(
    "Reset audit and permanently clear locally saved draft and photographs?"
  )) return;

  await stopStream(state.selfieStream);
  await stopStream(state.auditStream);

  try {
    await clearPhotos();
  } catch (err) {
    alert("Photos could not be fully cleared. Check browser storage.");
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Draft could not be cleared:", err);
  }

  window.location.reload();
});

/* ==========================================
   INITIALISATION
========================================== */

async function init() {
  renderSections();
  detectDevice();

  restoreDraft();
  await restorePhotos();

  officerSelect.value = state.officer;

  // Set initial default if officer exists but
  // no premise choice has previously been made.
  if (state.officer && !state.premiseChoice) {
    state.premiseChoice =
      singaporeHour() < 12 ? "am" : "pm";
  }

  updateAssignmentDisplay();
  updateLocationDisplay();

  if (state.selfie) {
    selfieStatus.textContent = "Completed";
    startSelfieBtn.textContent = "Retake selfie";

    selfiePreview.innerHTML =
      `<img src="${state.selfie.imageDataUrl}"
            alt="Officer selfie">`;

    collapseCard(selfieCard, selfieToggleBtn);
  }

  for (const section of SECTION_CONFIG) {
    refreshSectionUI(section.id, true);
  }

  updateCompletion();
  saveDraft();

  // Refresh displayed clock without changing
  // the officer's manually selected premise.
  setInterval(updateClock, 30000);

  if (!window.isSecureContext) {
    locationDetails.textContent =
      "Camera and GPS require HTTPS.";
  }
}

init().catch(err => {
  console.error("ESR initialisation failed:", err);
  alert("The app could not initialise. Please reload.");
});
