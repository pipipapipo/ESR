
"use strict";

/* =====================================================
   ESR AUDIT CAPTURE - COMPLETE APPLICATION
   Version: 2026-11-23
   Static GitHub Pages mock-up
===================================================== */

/* =====================================================
   1. CONFIGURATION
===================================================== */

const STORAGE_KEY = "esr-audit-draft-v3";
const DB_NAME = "esr-audit-photos-v3";
const DB_STORE = "photos";

const MAX_GPS_AGE_MS = 5 * 60 * 1000;
const MAX_GPS_ACCURACY_M = 150;

const ASSIGNMENTS = {
  "Officer A": {
    name: "Ng Wei Hong",
    am: "ABC Coffee Shop",
    pm: "Habibi Coffee Shop"
  },
  "Officer B": {
    name: "Chen Hanjie",
    am: "XYZ Eatery",
    pm: "Mala House"
  },
  "Officer C": {
    name: "Tan Chu Mei",
    am: "Sunrise Coffee Shop",
    pm: "Golden Wok Eatery"
  }
};

/*
  Keep your existing onion-skin filenames here.

  The first image uses the filename from your
  earlier code. The remaining five use the
  assets folder.

  Change these paths if your actual filenames
  differ.

  The onion skin is displayed at 25% opacity
  through styles.css. It is not burned into
  the captured photograph.
*/

const SECTION_CONFIG = [
  {
    id: "cubicles",
    name: "Cubicles",
    onionSkin: "IMG-20260930-WA0009.jpg",
    help:
      "Capture the cubicle area, including toilet " +
      "bowl or squat pan and surrounding floor."
  },
  {
    id: "general",
    name: "General Area",
    onionSkin: "assets/2.png",
    help:
      "Capture the general toilet floor and " +
      "common circulation area."
  },
  {
    id: "sink",
    name: "Sink Area",
    onionSkin: "assets/3.png",
    help:
      "Capture the wash-hand basins, vanity " +
      "tops and surrounding sink area."
  },
  {
    id: "urinal",
    name: "Urinal Area",
    onionSkin: "assets/4.png",
    help:
      "Capture the urinal area, including " +
      "the urinal surfaces and visible fittings."
  },
  {
    id: "misc",
    name: "Miscellaneous",
    onionSkin: "assets/5.png",
    help:
      "Capture the litter bin and relevant " +
      "miscellaneous toilet amenities."
  },
  {
    id: "tray",
    name: "Tray Return",
    onionSkin: "assets/6.png",
    help:
      "Capture the tray return infrastructure, " +
      "including racks, shelves and trays."
  }
];

/* =====================================================
   2. APPLICATION STATE
===================================================== */

function emptySections() {
  return Object.fromEntries(
    SECTION_CONFIG.map(section => [
      section.id,
      { overview: null }
    ])
  );
}

const state = {
  officer: "",
  premiseChoice: "",
  otherPremise: "",
  auditStartedAt: null,

  location: null,
  initialLocation: null,

  device: {},

  selfie: null,

  ecc: {
    photo: null,
    name: "",
    expiry: "",
    ocrText: "",
    ocrCompleted: false
  },

  sfa: {
    photo: null,
    licenceNumber: "",
    premiseName: "",
    expiry: "",
    ocrText: "",
    ocrCompleted: false
  },

  sections: emptySections(),

  selfieStream: null,
  auditStream: null,
  activeCapture: null,

  setupWasComplete: false,
  verificationWasComplete: false,

  saving: false
};

const $ = id => document.getElementById(id);

/* =====================================================
   3. DOM ELEMENTS
===================================================== */

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
const captureCanvas = $("captureCanvas");

const verificationCard = $("verificationCard");
const verificationToggleBtn =
  $("verificationToggleBtn");
const verificationStatus = $("verificationStatus");

const captureEccBtn = $("captureEccBtn");
const runEccOcrBtn = $("runEccOcrBtn");
const eccPreview = $("eccPreview");
const eccOcrStatus = $("eccOcrStatus");
const eccName = $("eccName");
const eccExpiry = $("eccExpiry");
const eccValidityStatus = $("eccValidityStatus");
const eccValidityDetails = $("eccValidityDetails");

const captureSfaBtn = $("captureSfaBtn");
const runSfaOcrBtn = $("runSfaOcrBtn");
const sfaPreview = $("sfaPreview");
const sfaOcrStatus = $("sfaOcrStatus");
const sfaLicenceNumber = $("sfaLicenceNumber");
const sfaPremiseName = $("sfaPremiseName");
const sfaExpiry = $("sfaExpiry");
const sfaValidityStatus = $("sfaValidityStatus");
const sfaValidityDetails = $("sfaValidityDetails");

const sectionsContainer = $("sectionsContainer");
const sectionTemplate = $("sectionTemplate");

const captureDialog = $("captureDialog");
const dialogTitle = $("dialogTitle");
const dialogHint = $("dialogHint");

const auditCamera = $("auditCamera");
const auditCanvas = $("auditCanvas");
const auditOnionSkin = $("auditOnionSkin");

const qualityMessage = $("qualityMessage");
const captureAuditBtn = $("captureAuditBtn");
const closeDialogBtn = $("closeDialogBtn");

const completionSummary = $("completionSummary");
const downloadBtn = $("downloadBtn");
const resetBtn = $("resetBtn");
const headerResetBtn = $("headerResetBtn");
const draftStatus = $("draftStatus");

/* =====================================================
   4. GENERAL HELPERS
===================================================== */

function setDraftStatus(message) {
  if (draftStatus) {
    draftStatus.textContent = message;
  }
}

function safeText(value) {
  return String(value ?? "").trim();
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [y, m, d] = value.split("-").map(Number);
  const test = new Date(Date.UTC(y, m - 1, d));

  return (
    test.getUTCFullYear() === y &&
    test.getUTCMonth() === m - 1 &&
    test.getUTCDate() === d
  );
}

function singaporeDateString() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const get = type =>
    parts.find(p => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function singaporeHour() {
  return Number(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Asia/Singapore",
        hour: "2-digit",
        hourCycle: "h23"
      }
    ).format(new Date())
  );
}

function singaporeDateTime() {
  return new Intl.DateTimeFormat(
    "en-SG",
    {
      timeZone: "Asia/Singapore",
      dateStyle: "medium",
      timeStyle: "medium"
    }
  ).format(new Date());
}

function getPremise() {
  if (state.premiseChoice === "other") {
    return safeText(state.otherPremise);
  }

  return (
    ASSIGNMENTS[state.officer]?.[
      state.premiseChoice
    ] || ""
  );
}

function getOfficerName() {
  return ASSIGNMENTS[state.officer]?.name || "";
}

function sanitizeFilename(text) {
  return (text || "premise")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .slice(0, 80);
}

function setBadge(element, text, type) {
  element.textContent = text;
  element.className = `badge ${type}`;
}

/* =====================================================
   5. LOCAL STORAGE - FORM DATA
===================================================== */

function saveDraft() {
  const draft = {
    officer: state.officer,
    premiseChoice: state.premiseChoice,
    otherPremise: state.otherPremise,
    auditStartedAt: state.auditStartedAt,

    location: state.location,
    initialLocation: state.initialLocation,

    ecc: {
      name: state.ecc.name,
      expiry: state.ecc.expiry,
      ocrText: state.ecc.ocrText,
      ocrCompleted: state.ecc.ocrCompleted
    },

    sfa: {
      licenceNumber: state.sfa.licenceNumber,
      premiseName: state.sfa.premiseName,
      expiry: state.sfa.expiry,
      ocrText: state.sfa.ocrText,
      ocrCompleted: state.sfa.ocrCompleted
    }
  };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(draft)
    );

    setDraftStatus("Draft saved on this device");

  } catch (error) {
    console.warn("Draft save failed:", error);
    setDraftStatus("Unable to save draft");
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      setDraftStatus("New audit");
      return;
    }

    const saved = JSON.parse(raw);

    state.officer =
      ASSIGNMENTS[saved.officer]
        ? saved.officer
        : "";

    state.premiseChoice =
      ["am", "pm", "other"].includes(
        saved.premiseChoice
      )
        ? saved.premiseChoice
        : "";

    state.otherPremise =
      saved.otherPremise || "";

    state.auditStartedAt =
      saved.auditStartedAt || null;

    state.location = saved.location || null;

    state.initialLocation =
      saved.initialLocation || null;

    if (saved.ecc) {
      state.ecc.name = saved.ecc.name || "";
      state.ecc.expiry = saved.ecc.expiry || "";
      state.ecc.ocrText = saved.ecc.ocrText || "";
      state.ecc.ocrCompleted =
        Boolean(saved.ecc.ocrCompleted);
    }

    if (saved.sfa) {
      state.sfa.licenceNumber =
        saved.sfa.licenceNumber || "";

      state.sfa.premiseName =
        saved.sfa.premiseName || "";

      state.sfa.expiry =
        saved.sfa.expiry || "";

      state.sfa.ocrText =
        saved.sfa.ocrText || "";

      state.sfa.ocrCompleted =
        Boolean(saved.sfa.ocrCompleted);
    }

    setDraftStatus("Previous draft restored");

  } catch (error) {
    console.warn("Draft restore failed:", error);
    setDraftStatus("Unable to restore draft");
  }
}

/* =====================================================
   6. INDEXEDDB - PHOTOGRAPHS
===================================================== */

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(
        new Error("IndexedDB is unavailable")
      );
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(
          DB_STORE,
          { keyPath: "id" }
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function savePhoto(id, record) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      DB_STORE,
      "readwrite"
    );

    transaction.objectStore(DB_STORE).put({
      id,
      record
    });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function restorePhotos() {
  try {
    const db = await openPhotoDB();

    const rows = await new Promise(
      (resolve, reject) => {
        const transaction = db.transaction(
          DB_STORE,
          "readonly"
        );

        const request = transaction
          .objectStore(DB_STORE)
          .getAll();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      }
    );

    db.close();

    for (const row of rows) {
      if (row.id === "selfie") {
        state.selfie = row.record;
        continue;
      }

      if (row.id === "ecc") {
        state.ecc.photo = row.record;
        continue;
      }

      if (row.id === "sfa") {
        state.sfa.photo = row.record;
        continue;
      }

      const [sectionId, shot] =
        row.id.split(":");

      if (
        state.sections[sectionId] &&
        shot === "overview"
      ) {
        state.sections[sectionId].overview =
          row.record;
      }
    }

  } catch (error) {
    console.warn("Photo restore failed:", error);
  }
}

async function clearPhotos() {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      DB_STORE,
      "readwrite"
    );

    transaction.objectStore(DB_STORE).clear();

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/* =====================================================
   7. OFFICER AND PREMISE SELECTION
===================================================== */

function updateClock() {
  if (!state.officer) return;

  auditDateTime.value = singaporeDateTime();
}

function updateAssignmentDisplay() {
  assignmentDetails.hidden = !state.officer;

  if (!state.officer) return;

  const assignment = ASSIGNMENTS[state.officer];

  amPremiseName.textContent = assignment.am;
  pmPremiseName.textContent = assignment.pm;

  document.querySelectorAll(
    'input[name="premiseChoice"]'
  ).forEach(radio => {
    radio.checked =
      radio.value === state.premiseChoice;
  });

  otherPremiseGroup.hidden =
    state.premiseChoice !== "other";

  otherPremiseInput.value =
    state.otherPremise;

  updateClock();
}

officerSelect.addEventListener(
  "change",
  () => {
    const previous = state.officer;

    state.officer = officerSelect.value;

    if (previous !== state.officer) {
      state.premiseChoice =
        singaporeHour() < 12 ? "am" : "pm";

      state.otherPremise = "";
    }

    if (
      state.officer &&
      !state.auditStartedAt
    ) {
      state.auditStartedAt =
        new Date().toISOString();
    }

    updateAssignmentDisplay();
    saveDraft();
    updateCompletion();
  }
);

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

otherPremiseInput.addEventListener(
  "input",
  () => {
    state.otherPremise =
      otherPremiseInput.value;

    saveDraft();
    updateCompletion();
  }
);

/* =====================================================
   8. DEVICE INFORMATION
===================================================== */

function detectDevice() {
  const userAgent =
    navigator.userAgent || "Unknown";

  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    "Unknown";

  const mobile =
    navigator.userAgentData?.mobile ??
    /Android|iPhone|iPad|Mobile/i.test(
      userAgent
    );

  state.device = {
    platform,
    mobile,
    userAgent,

    screen:
      `${window.screen.width}x` +
      `${window.screen.height}`,

    pixelRatio:
      window.devicePixelRatio || 1
  };

  deviceStatus.textContent =
    `${platform}${mobile ? " · mobile" : ""}`;
}

/* =====================================================
   9. GPS LOCATION
===================================================== */

function validLocation(location) {
  return Boolean(
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Number.isFinite(location.accuracyM) &&
    location.accuracyM <= MAX_GPS_ACCURACY_M &&
    location.capturedAt
  );
}

function locationIsFresh(location) {
  if (!validLocation(location)) return false;

  const age =
    Date.now() -
    new Date(location.capturedAt).getTime();

  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age <= MAX_GPS_AGE_MS
  );
}

function positionRecord(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,

    accuracyM:
      Math.round(position.coords.accuracy),

    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,

    capturedAt:
      new Date(position.timestamp).toISOString()
  };
}

function getFreshLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve(positionRecord(position));
      },

      () => {
        resolve(null);
      },

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
    const fresh =
      locationIsFresh(state.location);

    setBadge(
      locationStatus,
      fresh
        ? "Location ready"
        : "Location needs refresh",
      fresh ? "good" : "warn"
    );

    locationDetails.textContent =
      `Accuracy: ±${state.location.accuracyM} m · ` +
      `Captured: ${new Date(
        state.location.capturedAt
      ).toLocaleString("en-SG", {
        timeZone: "Asia/Singapore"
      })}`;

  } else {
    setBadge(
      locationStatus,
      "Not captured",
      "bad"
    );

    locationDetails.textContent =
      "GPS location is mandatory before proceeding.";
  }
}

locationBtn.addEventListener(
  "click",
  async () => {
    if (!state.officer) {
      alert("Select the audit officer first.");
      return;
    }

    locationBtn.disabled = true;

    setBadge(
      locationStatus,
      "Locating…",
      "warn"
    );

    const location =
      await getFreshLocation();

    locationBtn.disabled = false;

    if (!validLocation(location)) {
      updateLocationDisplay();

      locationDetails.textContent =
        "Unable to obtain an accurate GPS fix. " +
        "Enable location permission and try again.";

      return;
    }

    state.location = location;

    if (!state.initialLocation) {
      state.initialLocation = {
        ...location
      };
    }

    updateLocationDisplay();
    saveDraft();
    updateCompletion();
  }
);

/* =====================================================
   10. COLLAPSIBLE CARDS
===================================================== */

function toggleCard(card, button) {
  const collapsed =
    card.classList.toggle("collapsed");

  button.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );
}

function collapseCard(card, button) {
  card.classList.add("collapsed");

  button.setAttribute(
    "aria-expanded",
    "false"
  );
}

setupToggleBtn.addEventListener(
  "click",
  () => toggleCard(
    setupCard,
    setupToggleBtn
  )
);

selfieToggleBtn.addEventListener(
  "click",
  () => toggleCard(
    selfieCard,
    selfieToggleBtn
  )
);

verificationToggleBtn.addEventListener(
  "click",
  () => toggleCard(
    verificationCard,
    verificationToggleBtn
  )
);

/* =====================================================
   11. CAMERA FUNCTIONS
===================================================== */

function stopStream(stream) {
  if (!stream) return;

  stream.getTracks().forEach(
    track => track.stop()
  );
}

async function startCamera(
  videoElement,
  facingMode
) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Camera unavailable. Use HTTPS and allow camera access."
    );
  }

  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: facingMode
        },

        width: {
          ideal: 1920
        },

        height: {
          ideal: 1440
        }
      },

      audio: false
    });

  videoElement.srcObject = stream;

  await videoElement.play();

  return stream;
}

function captureFrame(
  videoElement,
  canvas
) {
  if (
    !videoElement.videoWidth ||
    !videoElement.videoHeight
  ) {
    throw new Error(
      "Camera is not ready."
    );
  }

  canvas.width =
    videoElement.videoWidth;

  canvas.height =
    videoElement.videoHeight;

  const context =
    canvas.getContext("2d");

  context.drawImage(
    videoElement,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,

    dataUrl:
      canvas.toDataURL(
        "image/jpeg",
        0.85
      )
  };
}

/* =====================================================
   12. IMAGE QUALITY CHECKS
===================================================== */

/*
  These are basic brightness, contrast and
  sharpness checks.

  They do not confirm that a photograph shows
  the correct object.

  For example, rejecting a chair photographed
  instead of a toilet bowl requires a trained
  image-classification or vision model.
*/

function assessImageQuality(canvas) {
  const sample =
    document.createElement("canvas");

  sample.width = 200;
  sample.height = 150;

  const context =
    sample.getContext("2d");

  context.drawImage(
    canvas,
    0,
    0,
    200,
    150
  );

  const imageData =
    context.getImageData(
      0,
      0,
      200,
      150
    ).data;

  const gray =
    new Float32Array(200 * 150);

  let sum = 0;
  let sumSq = 0;

  for (
    let i = 0, p = 0;
    i < imageData.length;
    i += 4, p++
  ) {
    const brightness =
      0.299 * imageData[i] +
      0.587 * imageData[i + 1] +
      0.114 * imageData[i + 2];

    gray[p] = brightness;

    sum += brightness;
    sumSq += brightness * brightness;
  }

  const mean =
    sum / gray.length;

  const variance =
    sumSq / gray.length -
    mean * mean;

  let edgeTotal = 0;
  let count = 0;

  for (
    let y = 1;
    y < 149;
    y += 2
  ) {
    for (
      let x = 1;
      x < 199;
      x += 2
    ) {
      const index =
        y * 200 + x;

      edgeTotal += Math.abs(
        4 * gray[index] -
        gray[index - 1] -
        gray[index + 1] -
        gray[index - 200] -
        gray[index + 200]
      );

      count++;
    }
  }

  const sharpness =
    edgeTotal / Math.max(count, 1);

  if (mean < 35) {
    return {
      accept: false,
      reason: "Image is too dark"
    };
  }

  if (mean > 235) {
    return {
      accept: false,
      reason: "Image is overexposed"
    };
  }

  if (variance < 180) {
    return {
      accept: false,
      reason: "Image contrast is too low"
    };
  }

  if (sharpness < 7) {
    return {
      accept: false,
      reason:
        "Image appears blurry. " +
        "Hold the phone steady and retake."
    };
  }

  return {
    accept: true,
    reason: "Basic image quality checks passed",
    brightness: mean,
    contrast: variance,
    sharpness
  };
}

/* =====================================================
   13. CAPTURE METADATA
===================================================== */

function createCaptureRecord(
  imageDataUrl,
  section,
  quality
) {
  return {
    section,

    imageDataUrl,

    capturedAt:
      new Date().toISOString(),

    officer: state.officer,
    officerName: getOfficerName(),

    premise: getPremise(),

    location:
      state.location
        ? { ...state.location }
        : null,

    device:
      { ...state.device },

    quality
  };
}

/* =====================================================
   14. SECTION 2 - OFFICER SELFIE
===================================================== */

startSelfieBtn.addEventListener(
  "click",
  async () => {
    if (!isSetupComplete()) {
      alert(
        "Complete the officer, premise and GPS first."
      );
      return;
    }

    stopStream(state.selfieStream);

    try {
      state.selfieStream =
        await startCamera(
          camera,
          "user"
        );

      captureSelfieBtn.disabled = false;

    } catch (error) {
      alert(
        `Front camera unavailable: ${error.message}`
      );
    }
  }
);

captureSelfieBtn.addEventListener(
  "click",
  async () => {
    if (!isSetupComplete()) {
      alert(
        "Complete audit details and GPS first."
      );
      return;
    }

    try {
      const captured =
        captureFrame(
          camera,
          captureCanvas
        );

      const quality =
        assessImageQuality(
          captured.canvas
        );

      if (!quality.accept) {
        alert(
          `Retake selfie: ${quality.reason}`
        );
        return;
      }

      const record =
        createCaptureRecord(
          captured.dataUrl,
          "selfie",
          quality
        );

      await savePhoto(
        "selfie",
        record
      );

      state.selfie = record;

      selfiePreview.innerHTML =
        `<img src="${record.imageDataUrl}" ` +
        `alt="Officer selfie">`;

      selfieStatus.textContent =
        "Completed";

      startSelfieBtn.textContent =
        "Retake Selfie";

      stopStream(state.selfieStream);

      state.selfieStream = null;
      camera.srcObject = null;

      captureSelfieBtn.disabled = true;

      collapseCard(
        selfieCard,
        selfieToggleBtn
      );

      updateCompletion();

    } catch (error) {
      alert(
        `Selfie capture failed: ${error.message}`
      );
    }
  }
);

/* =====================================================
   15. SECTION 3 - ECC AND SFA OCR
===================================================== */

function renderDocumentPreview(
  element,
  record,
  emptyText
) {
  element.innerHTML = "";

  if (!record) {
    element.textContent = emptyText;
    return;
  }

  const image =
    document.createElement("img");

  image.src = record.imageDataUrl;
  image.alt = "Captured document";

  element.appendChild(image);
}

/*
  OCR uses Tesseract.js loaded in index.html.

  OCR is run only when the officer clicks
  the relevant OCR button.

  Extracted fields remain editable because
  OCR may misread names, dates or numbers.
*/

async function runOCR(
  record,
  statusElement
) {
  if (!record) {
    throw new Error(
      "Capture the document first."
    );
  }

  if (
    !window.Tesseract ||
    !window.Tesseract.recognize
  ) {
    throw new Error(
      "OCR library unavailable. Check internet connection."
    );
  }

  statusElement.textContent =
    "Reading document. Please wait…";

  const result =
    await Tesseract.recognize(
      record.imageDataUrl,
      "eng",
      {
        logger: message => {
          if (
            message.status ===
            "recognizing text"
          ) {
            const progress =
              Math.round(
                (message.progress || 0) * 100
              );

            statusElement.textContent =
              `Reading document: ${progress}%`;
          }
        }
      }
    );

  return result.data.text || "";
}

/* =====================================================
   16. OCR DATE EXTRACTION
===================================================== */

function normalizeOCRDate(text) {
  const value = safeText(text);

  if (!value) return "";

  // DD/MM/YYYY or DD-MM-YYYY
  let match = value.match(
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/
  );

  if (match) {
    const day =
      match[1].padStart(2, "0");

    const month =
      match[2].padStart(2, "0");

    const year = match[3];

    const result =
      `${year}-${month}-${day}`;

    return isValidDateString(result)
      ? result
      : "";
  }

  // YYYY/MM/DD or YYYY-MM-DD
  match = value.match(
    /\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/
  );

  if (match) {
    const result =
      `${match[1]}-` +
      `${match[2].padStart(2, "0")}-` +
      `${match[3].padStart(2, "0")}`;

    return isValidDateString(result)
      ? result
      : "";
  }

  // 12 January 2027
  match = value.match(
    /\b(\d{1,2})\s+` +
    `(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|` +
    `Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|` +
    `Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|` +
    `Nov(?:ember)?|Dec(?:ember)?)` +
    `\s+(\d{4})\b/i
  );

  if (match) {
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
    };

    const monthNumber =
      months[match[2].slice(0, 3).toLowerCase()];

    const result =
      `${match[3]}-` +
      `${String(monthNumber).padStart(2, "0")}-` +
      `${match[1].padStart(2, "0")}`;

    return isValidDateString(result)
      ? result
      : "";
  }

  return "";
}

function extractExpiryDate(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const keywords =
    /expir|valid until|valid to|valid thru|valid through/i;

  for (let i = 0; i < lines.length; i++) {
    if (!keywords.test(lines[i])) continue;

    const current =
      normalizeOCRDate(lines[i]);

    if (current) return current;

    if (i + 1 < lines.length) {
      const next =
        normalizeOCRDate(lines[i + 1]);

      if (next) return next;
    }
  }

  // Do not guess that an unrelated date
  // is an expiry date.
  return "";
}

function extractFieldAfterLabel(
  text,
  labelPattern
) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!labelPattern.test(line)) {
      continue;
    }

    const colonIndex =
      line.indexOf(":");

    if (colonIndex >= 0) {
      const value =
        line.slice(colonIndex + 1).trim();

      if (value) return value;
    }

    const match =
      line.match(labelPattern);

    if (match) {
      const value =
        line.slice(
          match.index + match[0].length
        ).replace(/^[:\s-]+/, "").trim();

      if (value) return value;
    }

    if (i + 1 < lines.length) {
      return lines[i + 1];
    }
  }

  return "";
}

/* =====================================================
   17. ECC VERIFICATION
===================================================== */

captureEccBtn.addEventListener(
  "click",
  () => {
    openCaptureDialog({
      type: "document",
      documentType: "ecc",
      title: "Capture ECC Card",
      hint:
        "Use the rear camera. Ensure the " +
        "name and expiry date are readable."
    });
  }
);

runEccOcrBtn.addEventListener(
  "click",
  async () => {
    if (!state.ecc.photo) return;

    runEccOcrBtn.disabled = true;

    try {
      const text =
        await runOCR(
          state.ecc.photo,
          eccOcrStatus
        );

      state.ecc.ocrText = text;
      state.ecc.ocrCompleted = true;

      const name =
        extractFieldAfterLabel(
          text,
          /(?:ECC\s*)?Name/i
        );

      const expiry =
        extractExpiryDate(text);

      if (name) {
        state.ecc.name = name;
        eccName.value = name;
      }

      if (expiry) {
        state.ecc.expiry = expiry;
        eccExpiry.value = expiry;
      }

      eccOcrStatus.textContent =
        "OCR completed. Review and correct " +
        "the extracted fields if necessary.";

      saveDraft();
      updateEccValidity();
      updateCompletion();

    } catch (error) {
      eccOcrStatus.textContent =
        `OCR failed: ${error.message}`;

    } finally {
      runEccOcrBtn.disabled = false;
    }
  }
);

eccName.addEventListener(
  "input",
  () => {
    state.ecc.name = eccName.value;

    saveDraft();
    updateCompletion();
  }
);

eccExpiry.addEventListener(
  "change",
  () => {
    state.ecc.expiry = eccExpiry.value;

    saveDraft();
    updateEccValidity();
    updateCompletion();
  }
);

function updateEccValidity() {
  const expiry = state.ecc.expiry;

  if (!isValidDateString(expiry)) {
    setBadge(
      eccValidityStatus,
      "Not verified",
      "bad"
    );

    eccValidityDetails.textContent =
      "Enter and review the ECC expiry date.";

    return;
  }

  const today = singaporeDateString();

  if (expiry < today) {
    setBadge(
      eccValidityStatus,
      "Expired",
      "bad"
    );

    eccValidityDetails.textContent =
      `Expiry date ${expiry} is before today.`;

  } else {
    setBadge(
      eccValidityStatus,
      "Date current",
      "good"
    );

    eccValidityDetails.textContent =
      `Expiry date ${expiry} is current. ` +
      "This is a preliminary date check, " +
      "not official ECC credential verification.";
  }
}

/* =====================================================
   18. SFA LICENCE VERIFICATION
===================================================== */

captureSfaBtn.addEventListener(
  "click",
  () => {
    openCaptureDialog({
      type: "document",
      documentType: "sfa",
      title: "Capture SFA Licence",
      hint:
        "Use the rear camera. Ensure the " +
        "licence number and premise details " +
        "are readable."
    });
  }
);

runSfaOcrBtn.addEventListener(
  "click",
  async () => {
    if (!state.sfa.photo) return;

    runSfaOcrBtn.disabled = true;

    try {
      const text =
        await runOCR(
          state.sfa.photo,
          sfaOcrStatus
        );

      state.sfa.ocrText = text;
      state.sfa.ocrCompleted = true;

      const licenceNumber =
        extractFieldAfterLabel(
          text,
          /(?:Licence|License)\s*(?:No\.?|Number|#)/i
        );

      const premiseName =
        extractFieldAfterLabel(
          text,
          /(?:Premise|Business|Establishment)\s*Name/i
        );

      const expiry =
        extractExpiryDate(text);

      if (licenceNumber) {
        state.sfa.licenceNumber =
          licenceNumber;

        sfaLicenceNumber.value =
          licenceNumber;
      }

      if (premiseName) {
        state.sfa.premiseName =
          premiseName;

        sfaPremiseName.value =
          premiseName;
      }

      if (expiry) {
        state.sfa.expiry = expiry;
        sfaExpiry.value = expiry;
      }

      sfaOcrStatus.textContent =
        "OCR completed. Review the extracted " +
        "licence details.";

      saveDraft();
      updateSfaValidity();
      updateCompletion();

    } catch (error) {
      sfaOcrStatus.textContent =
        `OCR failed: ${error.message}`;

    } finally {
      runSfaOcrBtn.disabled = false;
    }
  }
);

sfaLicenceNumber.addEventListener(
  "input",
  () => {
    state.sfa.licenceNumber =
      sfaLicenceNumber.value;

    saveDraft();
    updateCompletion();
  }
);

sfaPremiseName.addEventListener(
  "input",
  () => {
    state.sfa.premiseName =
      sfaPremiseName.value;

    saveDraft();
    updateCompletion();
  }
);

sfaExpiry.addEventListener(
  "change",
  () => {
    state.sfa.expiry =
      sfaExpiry.value;

    saveDraft();
    updateSfaValidity();
    updateCompletion();
  }
);

function updateSfaValidity() {
  const expiry = state.sfa.expiry;

  if (!expiry) {
    setBadge(
      sfaValidityStatus,
      "Verification required",
      "warn"
    );

    sfaValidityDetails.textContent =
      "No expiry date entered. Some SFA " +
      "licences require verification through " +
      "their digital licence or official records.";

    return;
  }

  if (!isValidDateString(expiry)) {
    setBadge(
      sfaValidityStatus,
      "Invalid date",
      "bad"
    );

    sfaValidityDetails.textContent =
      "Review the entered expiry date.";

    return;
  }

  const today = singaporeDateString();

  if (expiry < today) {
    setBadge(
      sfaValidityStatus,
      "Expired date",
      "bad"
    );

    sfaValidityDetails.textContent =
      "The entered expiry date has passed.";

  } else {
    setBadge(
      sfaValidityStatus,
      "Date current",
      "good"
    );

    sfaValidityDetails.textContent =
      "The entered date is current. " +
      "Official SFA licence status has " +
      "not been independently verified.";
  }
}

/* =====================================================
   19. SECTION 4 - AUDIT PHOTO UI
===================================================== */

function renderSections() {
  sectionsContainer.innerHTML = "";

  for (const section of SECTION_CONFIG) {
    const fragment =
      sectionTemplate.content.cloneNode(true);

    const article =
      fragment.querySelector(".audit-section");

    article.dataset.section = section.id;

    article.querySelector("h3").textContent =
      section.name;

    article.querySelector(
      ".section-help"
    ).textContent = section.help;

    const toggle =
      article.querySelector(
        ".section-toggle-btn"
      );

    toggle.addEventListener(
      "click",
      () => toggleCard(
        article,
        toggle
      )
    );

    const captureButton =
      article.querySelector(
        ".capture-shot-btn"
      );

    captureButton.addEventListener(
      "click",
      () => {
        openCaptureDialog({
          type: "audit",
          sectionId: section.id,
          title: section.name,
          hint: section.help,
          onionSkin: section.onionSkin
        });
      }
    );

    sectionsContainer.appendChild(fragment);
  }
}

function refreshSectionUI(
  sectionId,
  autoCollapse = true
) {
  const article =
    document.querySelector(
      `.audit-section[data-section="${sectionId}"]`
    );

  if (!article) return;

  const record =
    state.sections[sectionId].overview;

  const preview =
    article.querySelector(".mini-preview");

  const button =
    article.querySelector(
      ".capture-shot-btn"
    );

  if (record) {
    preview.innerHTML =
      `<img src="${record.imageDataUrl}" ` +
      `alt="Audit photograph">`;

    button.textContent =
      "Retake Photograph";

    article.querySelector(
      ".section-progress"
    ).textContent = "1/1";

    if (autoCollapse) {
      collapseCard(
        article,
        article.querySelector(
          ".section-toggle-btn"
        )
      );
    }

  } else {
    preview.innerHTML = "";

    button.textContent =
      "Take Photograph";

    article.querySelector(
      ".section-progress"
    ).textContent = "0/1";
  }
}

/* =====================================================
   20. SHARED REAR CAMERA DIALOG
===================================================== */

async function openCaptureDialog(config) {
  if (!isSetupComplete()) {
    alert(
      "Complete officer, premise and GPS first."
    );
    return;
  }

  if (!state.selfie) {
    alert(
      "Complete the officer selfie first."
    );
    return;
  }

  state.activeCapture = config;

  dialogTitle.textContent =
    config.title;

  dialogHint.textContent =
    config.hint || "";

  qualityMessage.textContent =
    "Align the camera and hold the phone steady.";

  qualityMessage.className =
    "quality-message";

  if (
    config.type === "audit" &&
    config.onionSkin
  ) {
    auditOnionSkin.hidden = false;
    auditOnionSkin.src =
      config.onionSkin;

  } else {
    auditOnionSkin.hidden = true;
    auditOnionSkin.removeAttribute("src");
  }

  captureDialog.showModal();

  try {
    state.auditStream =
      await startCamera(
        auditCamera,
        "environment"
      );

  } catch (error) {
    alert(
      `Rear camera unavailable: ${error.message}`
    );

    closeCaptureDialog();
  }
}

function closeCaptureDialog() {
  stopStream(state.auditStream);

  state.auditStream = null;
  auditCamera.srcObject = null;

  state.activeCapture = null;

  if (captureDialog.open) {
    captureDialog.close();
  }
}

closeDialogBtn.addEventListener(
  "click",
  closeCaptureDialog
);

captureDialog.addEventListener(
  "cancel",
  event => {
    event.preventDefault();
    closeCaptureDialog();
  }
);

/* =====================================================
   21. SHARED PHOTO CAPTURE
===================================================== */

captureAuditBtn.addEventListener(
  "click",
  async () => {
    const config =
      state.activeCapture;

    if (!config) return;

    captureAuditBtn.disabled = true;

    try {
      const location =
        await getFreshLocation();

      if (!validLocation(location)) {
        qualityMessage.textContent =
          "Capture rejected. Fresh GPS " +
          "location is unavailable or inaccurate.";

        qualityMessage.className =
          "quality-message warn";

        return;
      }

      state.location = location;

      updateLocationDisplay();
      saveDraft();

      const captured =
        captureFrame(
          auditCamera,
          auditCanvas
        );

      const quality =
        assessImageQuality(
          captured.canvas
        );

      if (!quality.accept) {
        qualityMessage.textContent =
          `Capture rejected: ${quality.reason}`;

        qualityMessage.className =
          "quality-message warn";

        return;
      }

      if (config.type === "document") {
        const type =
          config.documentType;

        const record =
          createCaptureRecord(
            captured.dataUrl,
            type,
            quality
          );

        await savePhoto(
          type,
          record
        );

        if (type === "ecc") {
          state.ecc.photo = record;
          state.ecc.ocrCompleted = false;
          state.ecc.ocrText = "";
          state.ecc.name = "";
          state.ecc.expiry = "";

          eccName.value = "";
          eccExpiry.value = "";

          eccOcrStatus.textContent =
            "ECC card captured. Run OCR.";

          renderDocumentPreview(
            eccPreview,
            record,
            "No ECC card captured"
          );

          runEccOcrBtn.disabled = false;
          updateEccValidity();
        }

        if (type === "sfa") {
          state.sfa.photo = record;
          state.sfa.ocrCompleted = false;
          state.sfa.ocrText = "";
          state.sfa.licenceNumber = "";
          state.sfa.premiseName = "";
          state.sfa.expiry = "";

          sfaLicenceNumber.value = "";
          sfaPremiseName.value = "";
          sfaExpiry.value = "";

          sfaOcrStatus.textContent =
            "SFA licence captured. Run OCR.";

          renderDocumentPreview(
            sfaPreview,
            record,
            "No SFA licence captured"
          );

          runSfaOcrBtn.disabled = false;
          updateSfaValidity();
        }

        saveDraft();

      } else if (config.type === "audit") {
        const sectionId =
          config.sectionId;

        const record =
          createCaptureRecord(
            captured.dataUrl,
            sectionId,
            quality
          );

        await savePhoto(
          `${sectionId}:overview`,
          record
        );

        state.sections[
          sectionId
        ].overview = record;

        refreshSectionUI(
          sectionId,
          true
        );
      }

      closeCaptureDialog();
      updateCompletion();

    } catch (error) {
      qualityMessage.textContent =
        `Capture failed: ${error.message}`;

      qualityMessage.className =
        "quality-message warn";

    } finally {
      captureAuditBtn.disabled = false;
    }
  }
);

/* =====================================================
   22. COMPLETION CHECKS
===================================================== */

function isSetupComplete() {
  return Boolean(
    state.officer &&
    getPremise() &&
    validLocation(state.location)
  );
}

function isEccComplete() {
  return Boolean(
    state.ecc.photo &&
    safeText(state.ecc.name) &&
    isValidDateString(state.ecc.expiry) &&
    state.ecc.expiry >= singaporeDateString()
  );
}

function isSfaComplete() {
  /*
    SFA expiry may not appear on every
    licence format.

    For this mock-up, the required fields
    are the captured image, licence number
    and premise name.

    An official licence status check is
    outside the scope of this static site.
  */

  return Boolean(
    state.sfa.photo &&
    safeText(state.sfa.licenceNumber) &&
    safeText(state.sfa.premiseName) &&
    (
      !state.sfa.expiry ||
      (
        isValidDateString(state.sfa.expiry) &&
        state.sfa.expiry >= singaporeDateString()
      )
    )
  );
}

function isVerificationComplete() {
  return (
    isEccComplete() &&
    isSfaComplete()
  );
}

function updateCompletion() {
  const setupComplete =
    isSetupComplete();

  setupStatus.textContent =
    setupComplete
      ? "Completed"
      : "Not completed";

  if (
    setupComplete &&
    !state.setupWasComplete
  ) {
    collapseCard(
      setupCard,
      setupToggleBtn
    );
  }

  state.setupWasComplete =
    setupComplete;

  selfieStatus.textContent =
    state.selfie
      ? "Completed"
      : "Not completed";

  const verificationComplete =
    isVerificationComplete();

  verificationStatus.textContent =
    verificationComplete
      ? "Completed"
      : "Not completed";

  if (
    verificationComplete &&
    !state.verificationWasComplete
  ) {
    collapseCard(
      verificationCard,
      verificationToggleBtn
    );
  }

  state.verificationWasComplete =
    verificationComplete;

  let photoCount = 0;

  for (const section of SECTION_CONFIG) {
    if (
      state.sections[
        section.id
      ].overview
    ) {
      photoCount++;
    }
  }

  const missing = [];

  if (!state.officer) {
    missing.push("audit officer");
  }

  if (!getPremise()) {
    missing.push("premise");
  }

  if (!validLocation(state.location)) {
    missing.push("GPS location");
  }

  if (!state.selfie) {
    missing.push("officer selfie");
  }

  if (!isEccComplete()) {
    missing.push("ECC verification");
  }

  if (!isSfaComplete()) {
    missing.push("SFA licence details");
  }

  if (
    photoCount <
    SECTION_CONFIG.length
  ) {
    missing.push(
      `${SECTION_CONFIG.length - photoCount} ` +
      "audit photographs"
    );
  }

  if (missing.length > 0) {
    completionSummary.textContent =
      "Not ready for export.\n\n" +
      "Missing:\n" +
      missing.map(
        item => `• ${item}`
      ).join("\n");

    downloadBtn.disabled = true;

  } else {
    completionSummary.textContent =
      "Audit package ready.\n\n" +
      `Officer: ${getOfficerName()}\n` +
      `Premise: ${getPremise()}\n` +
      `ECC: Date current\n` +
      `SFA: Details captured; official verification pending\n` +
      `Audit photographs: ${photoCount}/6\n` +
      `GPS: Captured`;

    downloadBtn.disabled = false;
  }
}

/* =====================================================
   23. JSON EXPORT
===================================================== */

downloadBtn.addEventListener(
  "click",
  () => {
    updateCompletion();

    if (downloadBtn.disabled) return;

    const auditId =
      crypto.randomUUID?.() ||
      `audit-${Date.now()}`;

    const auditPackage = {
      schemaVersion: "3.0",
      auditId,

      exportedAt:
        new Date().toISOString(),

      officer: {
        id: state.officer,
        name: getOfficerName()
      },

      premise: {
        name: getPremise(),
        selection: state.premiseChoice,
        source: "Mock assignment"
      },

      auditStartedAt:
        state.auditStartedAt,

      device:
        state.device,

      initialLocation:
        state.initialLocation,

      latestLocation:
        state.location,

      selfie:
        state.selfie,

      ecc: {
        ...state.ecc
      },

      sfa: {
        ...state.sfa
      },

      auditSections:
        state.sections,

      limitations: [
        "This is a static GitHub Pages mock-up.",
        "GPS and device timestamps are not tamper-proof.",
        "OCR results require officer review.",
        "ECC validity is a preliminary expiry-date check.",
        "SFA validity is not verified against official records.",
        "Image quality checks do not verify image content.",
        "No automatic TCI scoring is performed.",
        "No central database is connected."
      ]
    };

    const blob = new Blob(
      [
        JSON.stringify(
          auditPackage,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `${sanitizeFilename(getPremise())}` +
      `-ESR-Audit.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }
);

/* =====================================================
   24. RESET ENTIRE AUDIT
===================================================== */

async function resetEntireAudit() {
  const confirmed = confirm(
    "Reset this audit?\n\n" +
    "This will permanently clear all locally " +
    "saved form information, GPS records, " +
    "selfie, ECC card, SFA licence and audit " +
    "photographs from this mock-up.\n\n" +
    "Previously downloaded audit packages " +
    "will not be deleted."
  );

  if (!confirmed) return;

  resetBtn.disabled = true;
  headerResetBtn.disabled = true;

  stopStream(state.selfieStream);
  stopStream(state.auditStream);

  try {
    await clearPhotos();

    localStorage.removeItem(
      STORAGE_KEY
    );

    window.location.reload();

  } catch (error) {
    alert(
      "Unable to clear all saved data. " +
      "Please check browser storage settings.\n\n" +
      error.message
    );

    resetBtn.disabled = false;
    headerResetBtn.disabled = false;
  }
}

resetBtn.addEventListener(
  "click",
  resetEntireAudit
);

headerResetBtn.addEventListener(
  "click",
  resetEntireAudit
);

/* =====================================================
   25. RESTORE VERIFICATION UI
===================================================== */

function restoreVerificationUI() {
  eccName.value =
    state.ecc.name;

  eccExpiry.value =
    state.ecc.expiry;

  sfaLicenceNumber.value =
    state.sfa.licenceNumber;

  sfaPremiseName.value =
    state.sfa.premiseName;

  sfaExpiry.value =
    state.sfa.expiry;

  renderDocumentPreview(
    eccPreview,
    state.ecc.photo,
    "No ECC card captured"
  );

  renderDocumentPreview(
    sfaPreview,
    state.sfa.photo,
    "No SFA licence captured"
  );

  runEccOcrBtn.disabled =
    !state.ecc.photo;

  runSfaOcrBtn.disabled =
    !state.sfa.photo;

  eccOcrStatus.textContent =
    state.ecc.ocrCompleted
      ? "OCR previously completed. Review the fields."
      : state.ecc.photo
        ? "ECC card captured. Run OCR."
        : "Awaiting ECC card capture.";

  sfaOcrStatus.textContent =
    state.sfa.ocrCompleted
      ? "OCR previously completed. Review the fields."
      : state.sfa.photo
        ? "SFA licence captured. Run OCR."
        : "Awaiting SFA licence capture.";

  updateEccValidity();
  updateSfaValidity();
}

/* =====================================================
   26. INITIALISATION
===================================================== */

async function init() {
  renderSections();
  detectDevice();

  restoreDraft();
  await restorePhotos();

  officerSelect.value =
    state.officer;

  if (
    state.officer &&
    !state.premiseChoice
  ) {
    state.premiseChoice =
      singaporeHour() < 12
        ? "am"
        : "pm";
  }

  updateAssignmentDisplay();
  updateLocationDisplay();

  if (state.selfie) {
    selfieStatus.textContent =
      "Completed";

    startSelfieBtn.textContent =
      "Retake Selfie";

    selfiePreview.innerHTML =
      `<img src="${state.selfie.imageDataUrl}" ` +
      `alt="Officer selfie">`;

    collapseCard(
      selfieCard,
      selfieToggleBtn
    );
  }

  restoreVerificationUI();

  for (const section of SECTION_CONFIG) {
    refreshSectionUI(
      section.id,
      true
    );
  }

  updateCompletion();

  saveDraft();

  // Refresh clock every 30 seconds.
  // Do not override a manually chosen premise.
  setInterval(
    updateClock,
    30000
  );

  // Refresh expiry-date assessments
  // when the page remains open overnight.
  setInterval(
    () => {
      updateEccValidity();
      updateSfaValidity();
      updateCompletion();
    },
    60000
  );

  if (!window.isSecureContext) {
    locationDetails.textContent =
      "Camera and GPS require a secure HTTPS connection.";
  }
}

init().catch(error => {
  console.error(
    "ESR initialisation failed:",
    error
  );

  alert(
    "The ESR application could not initialise. " +
    "Please reload the page."
  );
});

/* =====================================================
   END OF APP.JS
===================================================== */
