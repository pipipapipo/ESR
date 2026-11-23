
"use strict";

/* ==========================================
   ESR AUDIT CAPTURE
   GitHub Pages prototype
========================================== */

/* ASSIGNED PREMISES - MOCK-UP DATA */

const PREMISE_ASSIGNMENTS = {
  am: "ABC Coffee Shop",
  pm: "Habibi Coffee Shop"
};

/* AUDIT SECTIONS */

const SECTION_CONFIG = [
  {
    id: "cubicles",
    name: "Cubicles",
    onionSkin: "IMG-20260930-WA0009.jpg",
    help: "Overview should show the cubicle area / multiple cubicles. Close-up should clearly show one toilet bowl or squat pan.",
    closeupHint: "Centre a toilet bowl or squat pan. Avoid unrelated objects blocking the fixture."
  },
  {
    id: "general",
    name: "General Area",
    onionSkin: "assets/2.png",
    help: "Overview should show the general floor condition. Close-up should show any stain, wetness or cleanliness issue.",
    closeupHint: "Fill the frame with the relevant floor area, stain or wetness."
  },
  {
    id: "sink",
    name: "Sink Area",
    onionSkin: "assets/3.png",
    help: "Overview should show the vanity / sink area. Close-up should show one basin, vanity surface or tap area.",
    closeupHint: "Centre one basin and surrounding vanity surface."
  },
  {
    id: "urinal",
    name: "Urinal Area",
    onionSkin: "assets/4.png",
    help: "Overview should show the urinal bank / urinal area. Close-up should clearly show one urinal.",
    closeupHint: "Centre one complete urinal including the bowl / outlet area."
  },
  {
    id: "misc",
    name: "Miscellaneous",
    onionSkin: "assets/5.png",
    help: "Overview should show the miscellaneous area. Close-up should show the litter bin or other relevant amenity.",
    closeupHint: "Centre the litter bin or relevant amenity and keep it fully visible."
  }
];

/* STATE */

const state = {
  location: null,
  device: {},
  selfie: null,
  sections: Object.fromEntries(
    SECTION_CONFIG.map(s => [
      s.id,
      { overview: null, closeup: null }
    ])
  ),
  selfieStream: null,
  auditStream: null,
  activeCapture: null,
  assignmentTimestamp: null,
  initialLocation: null,
  setupWasComplete: false
};

/* ELEMENT REFERENCES */

const $ = id => document.getElementById(id);

const officerSelect = $("officerSelect");
const assignmentDetails = $("assignmentDetails");
const auditDateTime = $("auditDateTime");
const otherPremiseGroup = $("otherPremiseGroup");
const otherPremiseInput = $("otherPremiseInput");

const premiseRadios = document.querySelectorAll(
  'input[name="premiseChoice"]'
);

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
   INITIALISATION
========================================== */

function init() {
  renderSections();
  detectDevice();
  initialiseAssignmentUI();
  updateCompletion();

  if (!window.isSecureContext) {
    locationDetails.textContent =
      "Camera and geolocation require HTTPS. GitHub Pages provides HTTPS.";
  }
}

/* ==========================================
   DEVICE DETECTION
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
   SECTION 1 - ASSIGNED PREMISES
========================================== */

function getSelectedPremiseChoice() {
  return document.querySelector(
    'input[name="premiseChoice"]:checked'
  )?.value || "";
}

function getSelectedPremise() {
  const choice = getSelectedPremiseChoice();

  if (choice === "other") {
    return otherPremiseInput.value.trim();
  }

  return PREMISE_ASSIGNMENTS[choice] || "";
}

function getSingaporeHour() {
  const hour = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      hourCycle: "h23"
    }
  ).format(new Date());

  return Number(hour);
}

function selectDefaultPremise() {
  const defaultChoice =
    getSingaporeHour() < 12 ? "am" : "pm";

  const radio = document.querySelector(
    `input[name="premiseChoice"][value="${defaultChoice}"]`
  );

  if (radio) {
    radio.checked = true;
  }
}

function refreshAssignmentTime() {
  const now = new Date();

  auditDateTime.value = new Intl.DateTimeFormat(
    "en-SG",
    {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Singapore"
    }
  ).format(now);

  state.assignmentTimestamp = now.toISOString();
}

function handleOfficerSelection() {
  const hasOfficer = Boolean(officerSelect.value);

  assignmentDetails.hidden = !hasOfficer;

  if (hasOfficer) {
    if (!state.assignmentTimestamp) {
      refreshAssignmentTime();
    }

    if (!getSelectedPremiseChoice()) {
      selectDefaultPremise();
    }
  }

  handlePremiseSelection();
}

function handlePremiseSelection() {
  const choice = getSelectedPremiseChoice();

  otherPremiseGroup.hidden = choice !== "other";

  updateCompletion();
}

function initialiseAssignmentUI() {
  officerSelect.addEventListener(
    "change",
    handleOfficerSelection
  );

  premiseRadios.forEach(radio => {
    radio.addEventListener(
      "change",
      handlePremiseSelection
    );
  });

  otherPremiseInput.addEventListener(
    "input",
    updateCompletion
  );

  handleOfficerSelection();
}

/* ==========================================
   LOCATION
========================================== */

function positionToRecord(pos) {
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

function validLocation(loc) {
  return Boolean(
    loc &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
  );
}

function getFreshLocation(timeout = 15000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve(positionToRecord(pos)),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge: 0
      }
    );
  });
}

async function requestLocation() {
  if (!navigator.geolocation) {
    setLocationFailure(
      "Geolocation is not supported on this device."
    );
    return;
  }

  locationBtn.disabled = true;
  locationStatus.textContent = "Locating…";
  locationStatus.className = "badge bad";

  const loc = await getFreshLocation();

  locationBtn.disabled = false;

  if (!validLocation(loc)) {
    setLocationFailure(
      "Location unavailable. Enable location permission and try again."
    );
    return;
  }

  state.location = loc;

  if (!state.initialLocation) {
    state.initialLocation = structuredClone(loc);
  }

  locationStatus.textContent = "Location ready";
  locationStatus.className = "badge good";

  locationDetails.textContent =
    `Accuracy: ±${loc.accuracyM} m · captured ` +
    new Date(loc.capturedAt).toLocaleTimeString(
      "en-SG",
      { timeZone: "Asia/Singapore" }
    );

  updateCompletion();
}

function setLocationFailure(message) {
  state.location = null;

  locationStatus.textContent = "Unavailable";
  locationStatus.className = "badge bad";
  locationDetails.textContent = message;

  updateCompletion();
}

locationBtn.addEventListener("click", requestLocation);

/* ==========================================
   COLLAPSIBLE SECTIONS
========================================== */

setupToggleBtn.addEventListener("click", () => {
  const collapsed =
    setupCard.classList.toggle("collapsed");

  setupToggleBtn.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );
});

selfieToggleBtn.addEventListener("click", () => {
  const collapsed =
    selfieCard.classList.toggle("collapsed");

  selfieToggleBtn.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );
});

/* ==========================================
   SECTION 2 - OFFICER SELFIE
========================================== */

startSelfieBtn.addEventListener("click", async () => {
  if (!isSetupComplete()) {
    alert(
      "Complete officer selection, premise and GPS location first."
    );
    return;
  }

  await stopStream(state.selfieStream);

  try {
    state.selfieStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

    camera.srcObject = state.selfieStream;

    await camera.play();

    captureSelfieBtn.disabled = false;

  } catch (err) {
    alert(
      `Unable to access front camera: ${err.message}`
    );
  }
});

captureSelfieBtn.addEventListener(
  "click",
  async () => {
    if (!isSetupComplete()) {
      alert("Audit details and GPS are required.");
      return;
    }

    try {
      const captured =
        await captureFromVideo(camera, captureCanvas);

      const quality =
        assessImageQuality(captured.canvas);

      if (!quality.accept) {
        alert(
          `Please retake the selfie: ${quality.reason}`
        );
        return;
      }

      state.selfie = makeCaptureRecord(
        captured.dataUrl,
        "selfie",
        "selfie",
        quality
      );

      selfiePreview.innerHTML =
        `<img src="${captured.dataUrl}" alt="Officer selfie">`;

      await stopStream(state.selfieStream);

      state.selfieStream = null;
      camera.srcObject = null;

      captureSelfieBtn.disabled = true;
      startSelfieBtn.textContent = "Retake selfie";

      selfieStatus.textContent = "Completed";

      selfieCard.classList.add("collapsed");

      selfieToggleBtn.setAttribute(
        "aria-expanded",
        "false"
      );

      updateCompletion();

    } catch (err) {
      alert(`Selfie capture failed: ${err.message}`);
    }
  }
);

/* ==========================================
   SECTION 3 - AUDIT SECTIONS
========================================== */

function renderSections() {
  sectionsContainer.innerHTML = "";

  for (const section of SECTION_CONFIG) {
    const node = template.content.cloneNode(true);

    const article =
      node.querySelector(".audit-section");

    article.dataset.section = section.id;

    article.querySelector("h3").textContent =
      section.name;

    article.querySelector(".section-help").textContent =
      section.help;

    const toggleBtn =
      article.querySelector(".section-toggle-btn");

    toggleBtn.addEventListener("click", () => {
      const collapsed =
        article.classList.toggle("collapsed");

      toggleBtn.setAttribute(
        "aria-expanded",
        String(!collapsed)
      );
    });

    article.querySelectorAll(".capture-item")
      .forEach(item => {
        const shot = item.dataset.shot;

        const btn =
          item.querySelector(".capture-shot-btn");

        btn.addEventListener("click", () => {
          openAuditCapture(section.id, shot);
        });
      });

    sectionsContainer.appendChild(node);
  }
}

/* ==========================================
   REAR CAMERA
========================================== */

async function openAuditCapture(sectionId, shot) {
  if (!isSetupComplete()) {
    alert(
      "Complete officer selection, premise and GPS first."
    );
    return;
  }

  if (!state.selfie) {
    alert("Take the officer selfie first.");
    return;
  }

  const section = SECTION_CONFIG.find(
    s => s.id === sectionId
  );

  if (!section) return;

  state.activeCapture = {
    sectionId,
    shot
  };

  dialogTitle.textContent =
    `${section.name} — ` +
    (shot === "overview" ? "Overview" : "Close-up");

  dialogHint.textContent =
    shot === "overview"
      ? section.help
      : section.closeupHint;

  qualityMessage.textContent =
    "Align the live image with the reference guide.";

  qualityMessage.className = "quality-message";

  auditOnionSkin.onload = () => {
    qualityMessage.textContent =
      "Align the live image with the reference guide.";
    qualityMessage.className = "quality-message";
  };

  auditOnionSkin.onerror = () => {
    qualityMessage.textContent =
      `Reference image not found: ${section.onionSkin}. ` +
      "Camera capture can continue.";

    qualityMessage.className =
      "quality-message warn";
  };

  auditOnionSkin.src = section.onionSkin;

  captureDialog.showModal();

  await startAuditCamera();
}

async function startAuditCamera() {
  await stopStream(state.auditStream);

  try {
    state.auditStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      });

    auditCamera.srcObject = state.auditStream;

    await auditCamera.play();

  } catch (err) {
    alert(
      `Unable to access rear camera: ${err.message}`
    );

    await closeCaptureDialog();
  }
}

/* ==========================================
   AUDIT PHOTO CAPTURE
========================================== */

captureAuditBtn.addEventListener(
  "click",
  async () => {
    if (!state.activeCapture) return;

    captureAuditBtn.disabled = true;

    try {
      // Fresh GPS check before accepting a photo.
      const freshLocation =
        await getFreshLocation(10000);

      if (!validLocation(freshLocation)) {
        qualityMessage.textContent =
          "Rejected: A fresh GPS location could not be obtained.";

        qualityMessage.className =
          "quality-message warn";

        return;
      }

      state.location = freshLocation;

      const captured =
        await captureFromVideo(
          auditCamera,
          auditCanvas
        );

      const quality =
        assessImageQuality(captured.canvas);

      if (!quality.accept) {
        qualityMessage.textContent =
          `Rejected: ${quality.reason}`;

        qualityMessage.className =
          "quality-message warn";

        return;
      }

      const { sectionId, shot } =
        state.activeCapture;

      const record = makeCaptureRecord(
        captured.dataUrl,
        sectionId,
        shot,
        quality
      );

      state.sections[sectionId][shot] = record;

      refreshSectionUI(sectionId);

      await closeCaptureDialog();

      updateCompletion();

    } catch (err) {
      qualityMessage.textContent =
        `Capture failed: ${err.message}`;

      qualityMessage.className =
        "quality-message warn";

    } finally {
      captureAuditBtn.disabled = false;
    }
  }
);

closeDialogBtn.addEventListener(
  "click",
  closeCaptureDialog
);

captureDialog.addEventListener("cancel", e => {
  e.preventDefault();
  closeCaptureDialog();
});

async function closeCaptureDialog() {
  await stopStream(state.auditStream);

  state.auditStream = null;
  auditCamera.srcObject = null;
  state.activeCapture = null;

  if (captureDialog.open) {
    captureDialog.close();
  }
}

/* ==========================================
   PHOTO PREVIEW & COLLAPSE
========================================== */

function refreshSectionUI(sectionId) {
  const article = document.querySelector(
    `.audit-section[data-section="${sectionId}"]`
  );

  const sectionState =
    state.sections[sectionId];

  let count = 0;

  ["overview", "closeup"].forEach(shot => {
    const item = article.querySelector(
      `.capture-item[data-shot="${shot}"]`
    );

    const preview =
      item.querySelector(".mini-preview");

    const btn =
      item.querySelector(".capture-shot-btn");

    const record = sectionState[shot];

    if (record) {
      count++;

      preview.innerHTML =
        `<img src="${record.imageDataUrl}" ` +
        `alt="${sectionId} ${shot}">`;

      btn.textContent = `Retake ${shot}`;

    } else {
      preview.innerHTML = "";
      btn.textContent = `Take ${shot}`;
    }
  });

  article.querySelector(
    ".section-progress"
  ).textContent = `${count}/2`;

  if (count === 2) {
    article.classList.add("collapsed");

    article.querySelector(
      ".section-toggle-btn"
    ).setAttribute("aria-expanded", "false");
  }
}

/* ==========================================
   CAMERA FRAME CAPTURE
========================================== */

async function captureFromVideo(video, canvas) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    dataUrl: canvas.toDataURL(
      "image/jpeg",
      0.9
    )
  };
}

/* ==========================================
   BASIC IMAGE QUALITY CHECKS
========================================== */

function assessImageQuality(canvas) {
  const maxSize = 420;

  const scale = Math.min(
    1,
    maxSize / Math.max(
      canvas.width,
      canvas.height
    )
  );

  const w = Math.max(
    1,
    Math.floor(canvas.width * scale)
  );

  const h = Math.max(
    1,
    Math.floor(canvas.height * scale)
  );

  const temp = document.createElement("canvas");

  temp.width = w;
  temp.height = h;

  const ctx = temp.getContext(
    "2d",
    { willReadFrequently: true }
  );

  ctx.drawImage(canvas, 0, 0, w, h);

  const { data } =
    ctx.getImageData(0, 0, w, h);

  let sum = 0;
  let sumSq = 0;

  const gray = new Float32Array(w * h);

  for (
    let i = 0, p = 0;
    i < data.length;
    i += 4, p++
  ) {
    const g =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    gray[p] = g;

    sum += g;
    sumSq += g * g;
  }

  const mean = sum / gray.length;

  const variance =
    sumSq / gray.length - mean * mean;

  let edgeEnergy = 0;
  let edgeCount = 0;

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;

      const lap = Math.abs(
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - w] -
        gray[i + w]
      );

      edgeEnergy += lap;
      edgeCount++;
    }
  }

  edgeEnergy /= Math.max(1, edgeCount);

  const result = {
    accept: true,
    reason: "basic quality checks passed",
    brightness: mean,
    contrast: variance,
    sharpness: edgeEnergy
  };

  if (mean < 35) {
    return {
      ...result,
      accept: false,
      reason: "image is too dark"
    };
  }

  if (mean > 235) {
    return {
      ...result,
      accept: false,
      reason: "image is heavily overexposed"
    };
  }

  if (variance < 180) {
    return {
      ...result,
      accept: false,
      reason: "image has very low contrast or may be obstructed"
    };
  }

  if (edgeEnergy < 7) {
    return {
      ...result,
      accept: false,
      reason: "image appears blurry; hold the phone steady and retake"
    };
  }

  return result;
}

/* ==========================================
   PHOTO RECORD & METADATA
========================================== */

function makeCaptureRecord(
  imageDataUrl,
  section,
  shot,
  quality
) {
  return {
    section,
    shot,
    imageDataUrl,
    capturedAt: new Date().toISOString(),
    location: structuredClone(state.location),
    quality,
    device: structuredClone(state.device)
  };
}

/* ==========================================
   COMPLETION CHECKS
========================================== */

function isSetupComplete() {
  return Boolean(
    officerSelect.value &&
    getSelectedPremise() &&
    validLocation(state.location)
  );
}

function allAuditPhotosComplete() {
  return SECTION_CONFIG.every(s =>
    state.sections[s.id].overview &&
    state.sections[s.id].closeup
  );
}

function updateCompletion() {
  const setupComplete = isSetupComplete();

  setupStatus.textContent =
    setupComplete
      ? "Completed"
      : "Not completed";

  // Collapse only on transition to complete.
  // Do not repeatedly close it while editing.
  if (
    setupComplete &&
    !state.setupWasComplete
  ) {
    setupCard.classList.add("collapsed");

    setupToggleBtn.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  state.setupWasComplete = setupComplete;

  const missing = [];

  if (!officerSelect.value) {
    missing.push("officer");
  }

  if (!getSelectedPremise()) {
    missing.push("premise name");
  }

  if (!validLocation(state.location)) {
    missing.push("location");
  }

  if (!state.selfie) {
    missing.push("officer selfie");
  }

  let photoCount = 0;

  for (const s of SECTION_CONFIG) {
    if (state.sections[s.id].overview) {
      photoCount++;
    }

    if (state.sections[s.id].closeup) {
      photoCount++;
    }
  }

  if (!allAuditPhotosComplete()) {
    missing.push(
      `${10 - photoCount} audit photo(s)`
    );
  }

  if (missing.length) {
    completionSummary.textContent =
      `Not ready. Missing: ${missing.join(", ")}.`;

    downloadBtn.disabled = true;

  } else {
    completionSummary.textContent =
      `Ready to export.\n` +
      `Officer: ${officerSelect.selectedOptions[0].text}\n` +
      `Premise: ${getSelectedPremise()}\n` +
      `Audit photos: ${photoCount}/10\n` +
      `Location: captured`;

    downloadBtn.disabled = false;
  }
}

/* ==========================================
   SECTION 4 - JSON EXPORT
========================================== */

downloadBtn.addEventListener(
  "click",
  async () => {
    if (downloadBtn.disabled) return;

    // Revalidate before exporting.
    updateCompletion();

    if (downloadBtn.disabled) return;

    const auditId =
      crypto.randomUUID?.() ||
      `audit-${Date.now()}`;

    const packageData = {
      schemaVersion: "1.1",
      auditId,
      exportedAt: new Date().toISOString(),

      officer: {
        id: officerSelect.value,
        name: officerSelect.selectedOptions[0].text
      },

      premiseName: getSelectedPremise(),

      premiseSelection: getSelectedPremiseChoice(),

      assignmentTimestamp:
        state.assignmentTimestamp,

      auditDateTimeDisplay:
        auditDateTime.value,

      device: state.device,

      initialLocation: state.initialLocation,

      latestLocation: state.location,

      selfie: state.selfie,

      sections: state.sections,

      notes: {
        captureMethod:
          "getUserMedia live camera; no gallery upload control is exposed",

        assignmentSource:
          "Static demonstration assignments; not connected to a central assignment system",

        limitations: [
          "Browser geolocation can be spoofed and is not tamper-proof.",
          "Device clock can be altered.",
          "Exact phone model is generally unavailable.",
          "Image quality checks detect blur and exposure only.",
          "Semantic fixture validation requires a trained vision model or API.",
          "This prototype does not perform TCI scoring or ESR enforcement classification."
        ]
      }
    };

    // Digest for accidental-change detection.
    // This is not a secure digital signature.
    const canonical = JSON.stringify({
      ...packageData,
      selfie: undefined,
      sections: stripImageData(
        state.sections
      )
    });

    packageData.metadataSha256 =
      await sha256(canonical);

    const blob = new Blob(
      [JSON.stringify(packageData, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download =
      `${sanitizeFilename(getSelectedPremise())}-` +
      `${new Date().toISOString().slice(0, 10)}-audit.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
);

/* ==========================================
   RESET AUDIT
========================================== */

resetBtn.addEventListener(
  "click",
  async () => {
    if (!confirm(
      "Reset this audit and remove all captured photos?"
    )) {
      return;
    }

    await stopStream(state.selfieStream);
    await stopStream(state.auditStream);

    location.reload();
  }
);

/* ==========================================
   UTILITY FUNCTIONS
========================================== */

function stripImageData(sections) {
  const output = {};

  for (const [section, shots] of
    Object.entries(sections)) {

    output[section] = {};

    for (const [shot, rec] of
      Object.entries(shots)) {

      if (!rec) {
        output[section][shot] = null;

      } else {
        const { imageDataUrl, ...rest } = rec;
        output[section][shot] = rest;
      }
    }
  }

  return output;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return [...new Uint8Array(hash)]
    .map(b =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

function sanitizeFilename(value) {
  return (value || "premise")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "premise";
}

async function stopStream(stream) {
  if (!stream) return;

  stream.getTracks().forEach(
    track => track.stop()
  );
}

/* START APPLICATION */

init();
