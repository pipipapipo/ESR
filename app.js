
"use strict";

// =====================================================
// ESR AUDIT CAPTURE - MOCK-UP VERSION 4
// =====================================================

const FORM_KEY = "esr-form-v4";
const DB_NAME = "esr-images-v4";
const PHOTO_STORE = "photos";

// FIXED MOCK-UP OFFICER SCHEDULES

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

// SIX AUDIT AREAS - ONE PHOTO EACH

const AREAS = [
  {
    id: "cubicles",
    name: "Cubicles",
    guide: "IMG-20260930-WA0009.jpg",
    help: "Show the cubicle, bowl or squat pan and nearby floor."
  },
  {
    id: "general",
    name: "General Area",
    guide: "assets/2.png",
    help: "Show the general toilet floor and circulation area."
  },
  {
    id: "sink",
    name: "Sink Area",
    guide: "assets/3.png",
    help: "Show basins, vanity tops and surrounding surfaces."
  },
  {
    id: "urinal",
    name: "Urinal Area",
    guide: "assets/4.png",
    help: "Show urinals and their visible fittings."
  },
  {
    id: "misc",
    name: "Miscellaneous",
    guide: "assets/5.png",
    help: "Show litter bins and other relevant amenities."
  },
  {
    id: "tray",
    name: "Tray Return",
    guide: "assets/6.png",
    help: "Show tray return racks, shelves and trays."
  }
];

const $ = id => document.getElementById(id);

// APPLICATION STATE

const state = {
  officer: "",
  choice: "",
  other: "",
  startedAt: null,

  location: null,
  initialLocation: null,

  selfie: null,
  eccPhoto: null,
  sfaPhoto: null,

  eccName: "",
  eccNumber: "",
  eccExpiry: "",
  eccOcrText: "",
  eccOcrDone: false,

  photos: Object.fromEntries(
    AREAS.map(a => [a.id, null])
  ),

  selfieStream: null,
  rearStream: null,
  active: null,

  setupWasComplete: false,
  verificationWasComplete: false
};

// =====================================================
// 1. LOCAL FORM STORAGE
// =====================================================

function saveForm() {
  try {
    localStorage.setItem(
      FORM_KEY,
      JSON.stringify({
        officer: state.officer,
        choice: state.choice,
        other: state.other,
        startedAt: state.startedAt,

        location: state.location,
        initialLocation: state.initialLocation,

        eccName: state.eccName,
        eccNumber: state.eccNumber,
        eccExpiry: state.eccExpiry,
        eccOcrText: state.eccOcrText,
        eccOcrDone: state.eccOcrDone
      })
    );

    $("draftStatus").textContent =
      "Draft saved on this device";

  } catch (e) {
    $("draftStatus").textContent =
      "Draft saving unavailable";

    console.warn(e);
  }
}

function restoreForm() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(FORM_KEY) || "null"
    );

    if (!saved) return;

    state.officer = ASSIGNMENTS[saved.officer]
      ? saved.officer
      : "";

    state.choice = ["am", "pm", "other"].includes(
      saved.choice
    )
      ? saved.choice
      : "";

    state.other = saved.other || "";
    state.startedAt = saved.startedAt || null;

    state.location = saved.location || null;
    state.initialLocation =
      saved.initialLocation || null;

    state.eccName = saved.eccName || "";
    state.eccNumber = saved.eccNumber || "";
    state.eccExpiry = saved.eccExpiry || "";

    state.eccOcrText = saved.eccOcrText || "";
    state.eccOcrDone = Boolean(
      saved.eccOcrDone
    );

    $("draftStatus").textContent =
      "Saved draft restored";

  } catch (e) {
    console.warn("Draft recovery failed", e);
  }
}

// =====================================================
// 2. INDEXEDDB FOR PHOTOGRAPH RECOVERY
// =====================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      if (
        !req.result.objectStoreNames.contains(
          PHOTO_STORE
        )
      ) {
        req.result.createObjectStore(
          PHOTO_STORE
        );
      }
    };

    req.onsuccess = () => resolve(
      req.result
    );

    req.onerror = () => reject(
      req.error
    );
  });
}

async function dbAction(mode, operation) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      PHOTO_STORE,
      mode
    );

    let result;

    const request = operation(
      tx.objectStore(PHOTO_STORE)
    );

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
    }

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };

    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const putPhoto = (key, record) =>
  dbAction(
    "readwrite",
    store => store.put(record, key)
  );

const getPhoto = key =>
  dbAction(
    "readonly",
    store => store.get(key)
  );

const clearPhotos = () =>
  dbAction(
    "readwrite",
    store => store.clear()
  );

// =====================================================
// 3. DATE AND TIME
// =====================================================

const singaporeHour = () =>
  Number(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Asia/Singapore",
        hour: "2-digit",
        hourCycle: "h23"
      }
    ).format(new Date())
  );

const todaySG = () => {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const value = type =>
    parts.find(
      p => p.type === type
    ).value;

  return (
    `${value("year")}-` +
    `${value("month")}-` +
    `${value("day")}`
  );
};

const officerName = () =>
  ASSIGNMENTS[state.officer]?.name || "";

function premiseName() {
  return state.choice === "other"
    ? state.other.trim()
    : (
      ASSIGNMENTS[state.officer]?.[
        state.choice
      ] || ""
    );
}

// =====================================================
// 4. OFFICER SELECTION
// =====================================================

function showAssignment() {
  $("assignmentDetails").hidden =
    !state.officer;

  if (!state.officer) return;

  $("amPremiseName").textContent =
    ASSIGNMENTS[state.officer].am;

  $("pmPremiseName").textContent =
    ASSIGNMENTS[state.officer].pm;

  document.querySelectorAll(
    'input[name="premiseChoice"]'
  ).forEach(radio => {
    radio.checked =
      radio.value === state.choice;
  });

  $("otherPremiseGroup").hidden =
    state.choice !== "other";

  $("otherPremiseInput").value =
    state.other;

  updateClock();
}

function updateClock() {
  if (!state.officer) return;

  $("auditDateTime").value =
    new Intl.DateTimeFormat(
      "en-SG",
      {
        timeZone: "Asia/Singapore",
        dateStyle: "full",
        timeStyle: "medium"
      }
    ).format(new Date());
}

$("officerSelect").addEventListener(
  "change",
  () => {
    const next =
      $("officerSelect").value;

    const evidenceExists = Boolean(
      state.selfie ||
      state.eccPhoto ||
      state.sfaPhoto ||
      Object.values(state.photos).some(Boolean)
    );

    if (
      next !== state.officer &&
      evidenceExists
    ) {
      if (!confirm(
        "Changing officer may mix evidence between audits. " +
        "Reset the current audit and select a new officer?"
      )) {
        $("officerSelect").value =
          state.officer;
        return;
      }

      resetAudit(false).then(() => {
        state.officer = next;

        state.choice =
          singaporeHour() < 12
            ? "am"
            : "pm";

        state.startedAt =
          new Date().toISOString();

        $("officerSelect").value = next;

        showAssignment();
        saveForm();
        updateCompletion();
      }).catch(err => {
        alert(`Unable to reset audit: ${err.message}`);
        $("officerSelect").value = state.officer;
      });

      return;
    }

    state.officer = next;

    state.choice = next
      ? (
        singaporeHour() < 12
          ? "am"
          : "pm"
      )
      : "";

    if (
      next &&
      !state.startedAt
    ) {
      state.startedAt =
        new Date().toISOString();
    }

    showAssignment();
    saveForm();
    updateCompletion();
  }
);

document.querySelectorAll(
  'input[name="premiseChoice"]'
).forEach(radio => {
  radio.addEventListener(
    "change",
    () => {
      state.choice = radio.value;

      $("otherPremiseGroup").hidden =
        radio.value !== "other";

      saveForm();
      updateCompletion();
    }
  );
});

$("otherPremiseInput").addEventListener(
  "input",
  () => {
    state.other =
      $("otherPremiseInput").value;

    saveForm();
    updateCompletion();
  }
);

// =====================================================
// 5. GPS LOCATION
// =====================================================

function positionRecord(pos) {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,

    accuracyM: Math.round(
      pos.coords.accuracy
    ),

    capturedAt:
      new Date(pos.timestamp).toISOString()
  };
}

function validGPS(loc) {
  return Boolean(
    loc &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
  );
}

function getGPS() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve(
        positionRecord(pos)
      ),

      () => resolve(null),

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

function badge(id, label, kind) {
  $(id).textContent = label;
  $(id).className = `badge ${kind}`;
}

function showGPS() {
  if (!validGPS(state.location)) {
    badge(
      "locationStatus",
      "Not captured",
      "bad"
    );

    $("locationDetails").textContent =
      "GPS is required before live capture.";

  } else {
    badge(
      "locationStatus",
      "Location captured",
      "good"
    );

    const loc = state.location;

    $("locationDetails").textContent =
      `Accuracy: ±${loc.accuracyM} m; captured ` +
      new Date(loc.capturedAt).toLocaleString(
        "en-SG",
        {
          timeZone: "Asia/Singapore"
        }
      );
  }
}

$("locationBtn").addEventListener(
  "click",
  async () => {
    if (!state.officer) {
      alert("Select an officer first.");
      return;
    }

    $("locationBtn").disabled = true;

    badge(
      "locationStatus",
      "Locating…",
      "warn"
    );

    const loc = await getGPS();

    $("locationBtn").disabled = false;

    if (!validGPS(loc)) {
      showGPS();

      $("locationDetails").textContent =
        "Could not obtain GPS. Check browser " +
        "permission and try again.";

      return;
    }

    state.location = loc;

    if (!state.initialLocation) {
      state.initialLocation = {
        ...loc
      };
    }

    showGPS();
    saveForm();
    updateCompletion();
  }
);

// =====================================================
// 6. COLLAPSIBLE CARDS
// =====================================================

function collapse(cardId, buttonId) {
  $(cardId).classList.add("collapsed");

  $(buttonId).setAttribute(
    "aria-expanded",
    "false"
  );
}

for (const [cardId, buttonId] of [
  ["setupCard", "setupToggleBtn"],
  ["selfieCard", "selfieToggleBtn"],
  ["verificationCard", "verificationToggleBtn"]
]) {
  $(buttonId).addEventListener(
    "click",
    () => {
      const collapsed =
        $(cardId).classList.toggle(
          "collapsed"
        );

      $(buttonId).setAttribute(
        "aria-expanded",
        String(!collapsed)
      );
    }
  );
}

// =====================================================
// 7. CAMERA FUNCTIONS
// =====================================================

function stopStream(stream) {
  stream?.getTracks().forEach(
    track => track.stop()
  );
}

async function startCamera(video, facing) {
  if (
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error(
      "Camera requires HTTPS and browser permission."
    );
  }

  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: facing
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

  // Reject a known front-camera selection
  // for document and audit capture.
  const actual = stream
    .getVideoTracks()[0]
    ?.getSettings()
    ?.facingMode;

  if (
    facing === "environment" &&
    actual === "user"
  ) {
    stopStream(stream);

    throw new Error(
      "Rear camera not available; front camera " +
      "cannot be used for documents or audits."
    );
  }

  video.srcObject = stream;

  try {
    await video.play();

  } catch (e) {
    stopStream(stream);
    throw e;
  }

  return stream;
}

function snap(video, canvas) {
  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {
    throw new Error(
      "Camera not ready."
    );
  }

  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;

  canvas.getContext("2d").drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,

    imageDataUrl:
      canvas.toDataURL(
        "image/jpeg",
        0.87
      )
  };
}

// =====================================================
// 8. IMAGE QUALITY VALIDATION
// =====================================================

function checkQuality(canvas) {
  const c =
    document.createElement("canvas");

  c.width = 320;
  c.height = 240;

  const ctx = c.getContext(
    "2d",
    {
      willReadFrequently: true
    }
  );

  ctx.drawImage(
    canvas,
    0,
    0,
    c.width,
    c.height
  );

  const pix = ctx.getImageData(
    0,
    0,
    c.width,
    c.height
  ).data;

  const gray =
    new Float32Array(
      c.width * c.height
    );

  let sum = 0;
  let sq = 0;

  for (
    let i = 0, p = 0;
    i < pix.length;
    i += 4, p++
  ) {
    const g =
      .299 * pix[i] +
      .587 * pix[i + 1] +
      .114 * pix[i + 2];

    gray[p] = g;

    sum += g;
    sq += g * g;
  }

  const mean =
    sum / gray.length;

  const variance =
    sq / gray.length -
    mean * mean;

  let edge = 0;
  let count = 0;

  for (
    let y = 1;
    y < 239;
    y += 2
  ) {
    for (
      let x = 1;
      x < 319;
      x += 2
    ) {
      const i =
        y * 320 + x;

      edge += Math.abs(
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - 320] -
        gray[i + 320]
      );

      count++;
    }
  }

  const sharpness =
    edge / Math.max(1, count);

  if (mean < 35) {
    return {
      accept: false,
      reason: "Too dark"
    };
  }

  if (mean > 235) {
    return {
      accept: false,
      reason: "Overexposed"
    };
  }

  if (variance < 180) {
    return {
      accept: false,
      reason: "Low contrast or obstructed lens"
    };
  }

  if (sharpness < 6) {
    return {
      accept: false,
      reason:
        "Image appears blurry; hold steady and retake"
    };
  }

  return {
    accept: true,
    brightness: Math.round(mean),
    sharpness:
      Number(sharpness.toFixed(1))
  };
}

// =====================================================
// 9. CAPTURE METADATA
// =====================================================

function record(
  imageDataUrl,
  category,
  quality
) {
  return {
    category,
    imageDataUrl,

    capturedAt:
      new Date().toISOString(),

    officer: state.officer,
    premise: premiseName(),

    location:
      { ...state.location },

    quality
  };
}

function imageIn(el, rec) {
  $(el).replaceChildren();

  if (!rec) return;

  const img =
    document.createElement("img");

  img.src = rec.imageDataUrl;
  img.alt = "Captured photograph";

  $(el).appendChild(img);
}

const setupReady = () =>
  Boolean(
    state.officer &&
    premiseName() &&
    validGPS(state.location)
  );

// =====================================================
// 10. OFFICER SELFIE
// =====================================================

$("startSelfieBtn").addEventListener(
  "click",
  async () => {
    if (!setupReady()) {
      alert(
        "Complete officer, premise and GPS first."
      );
      return;
    }

    stopStream(state.selfieStream);

    try {
      state.selfieStream =
        await startCamera(
          $("camera"),
          "user"
        );

      $("captureSelfieBtn").disabled =
        false;

    } catch (e) {
      alert(
        `Front camera unavailable: ${e.message}`
      );
    }
  }
);

$("captureSelfieBtn").addEventListener(
  "click",
  async () => {
    try {
      if (!setupReady()) {
        alert(
          "Complete audit details first."
        );
        return;
      }

      const pic = snap(
        $("camera"),
        $("captureCanvas")
      );

      const q =
        checkQuality(pic.canvas);

      if (!q.accept) {
        alert(
          `Retake selfie: ${q.reason}`
        );
        return;
      }

      const rec = record(
        pic.imageDataUrl,
        "selfie",
        q
      );

      await putPhoto(
        "selfie",
        rec
      );

      state.selfie = rec;

      imageIn(
        "selfiePreview",
        rec
      );

      $("startSelfieBtn").textContent =
        "Retake selfie";

      stopStream(state.selfieStream);

      state.selfieStream = null;
      $("camera").srcObject = null;

      $("captureSelfieBtn").disabled =
        true;

      collapse(
        "selfieCard",
        "selfieToggleBtn"
      );

      updateCompletion();

    } catch (e) {
      alert(
        `Could not save selfie: ${e.message}`
      );
    }
  }
);

// =====================================================
// 11. ECC DATE VALIDATION
// =====================================================

const validDate = s => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s)
  ) {
    return false;
  }

  const [y, m, d] =
    s.split("-").map(Number);

  const t =
    new Date(
      Date.UTC(y, m - 1, d)
    );

  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  );
};

function parseDate(text) {
  if (!text) return "";

  // YYYY-MM-DD
  let m = text.match(
    /\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/
  );

  if (m) {
    const s =
      `${m[1]}-` +
      `${m[2].padStart(2, "0")}-` +
      `${m[3].padStart(2, "0")}`;

    if (validDate(s)) return s;
  }

  // DD/MM/YYYY
  m = text.match(
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/
  );

  if (m) {
    const s =
      `${m[3]}-` +
      `${m[2].padStart(2, "0")}-` +
      `${m[1].padStart(2, "0")}`;

    if (validDate(s)) return s;
  }

  // 12 January 2027
  m = text.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i
  );

  if (m) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec"
    ];

    const month =
      months.indexOf(
        m[2].slice(0, 3).toLowerCase()
      ) + 1;

    const s =
      `${m[3]}-` +
      `${String(month).padStart(2, "0")}-` +
      `${m[1].padStart(2, "0")}`;

    if (validDate(s)) return s;
  }

  return "";
}

// =====================================================
// 12. ECC OCR FIELD EXTRACTION
// =====================================================

function fieldAfterLabel(lines, regex) {
  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const match =
      lines[i].match(regex);

    if (!match) continue;

    const sameLine =
      lines[i]
        .slice(
          match.index + match[0].length
        )
        .replace(
          /^[\s:;#-]+/,
          ""
        )
        .trim();

    if (sameLine) {
      return sameLine;
    }

    if (lines[i + 1]) {
      return lines[i + 1];
    }
  }

  return "";
}

function extractEcc(text) {
  const lines = text
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(Boolean);

  const name =
    fieldAfterLabel(
      lines,
      /(?:Full\s*)?Name\b\s*:?/i
    );

  const number =
    fieldAfterLabel(
      lines,
      /(?:ECC|ECO|Registration|Certificate|Cert\.?|ID)\s*(?:No\.?|Number|#|ID)?\s*:?/i
    );

  let expiry = "";

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    if (
      !/(?:expir(?:y|es|ation)?|valid\s*(?:until|to|thru|through)|expiry\s*date)/i
        .test(lines[i])
    ) {
      continue;
    }

    expiry =
      parseDate(lines[i]) ||
      parseDate(
        lines[i + 1] || ""
      );

    if (expiry) break;
  }

  return {
    name,
    number,
    expiry
  };
}

// =====================================================
// 13. ECC VALIDITY STATUS
// =====================================================

function eccDateStatus() {
  if (!state.eccPhoto) {
    badge(
      "eccValidityStatus",
      "Not checked",
      "bad"
    );

    $("eccValidityDetails").textContent =
      "Capture the ECC card to assess the date.";

    return;
  }

  if (!validDate(state.eccExpiry)) {
    badge(
      "eccValidityStatus",
      "Review required",
      "warn"
    );

    $("eccValidityDetails").textContent =
      "Expiry date not reliably extracted. " +
      "Check the card and correct the field if necessary.";

    return;
  }

  if (
    state.eccExpiry < todaySG()
  ) {
    badge(
      "eccValidityStatus",
      "Expired",
      "bad"
    );

    $("eccValidityDetails").textContent =
      `Expiry date ${state.eccExpiry} has passed.`;

    return;
  }

  badge(
    "eccValidityStatus",
    "Valid (date check)",
    "good"
  );

  $("eccValidityDetails").textContent =
    `Expiry date ${state.eccExpiry} has not passed. ` +
    "OCR and date comparison do not verify official ECC registration.";
}

// =====================================================
// 14. AUTOMATIC ECC OCR
// =====================================================

async function autoEccOCR() {
  if (!state.eccPhoto) return;

  $("eccOcrStatus").textContent =
    "Automatically reading ECC card…";

  if (!window.Tesseract?.recognize) {
    $("eccOcrStatus").textContent =
      "OCR library unavailable (internet required). " +
      "Check card fields manually.";

    return;
  }

  try {
    const out =
      await Tesseract.recognize(
        state.eccPhoto.imageDataUrl,
        "eng",
        {
          logger: msg => {
            if (
              msg.status ===
              "recognizing text"
            ) {
              $("eccOcrStatus").textContent =
                "Automatic ECC OCR: " +
                `${Math.round(msg.progress * 100)}%`;
            }
          }
        }
      );

    state.eccOcrText =
      out.data.text || "";

    const found =
      extractEcc(
        state.eccOcrText
      );

    state.eccName = found.name;
    state.eccNumber = found.number;
    state.eccExpiry = found.expiry;

    state.eccOcrDone = true;

    $("eccName").value =
      state.eccName;

    $("eccNumber").value =
      state.eccNumber;

    $("eccExpiry").value =
      state.eccExpiry;

    const missing = [
      !found.name && "name",
      !found.number && "ECC number",
      !found.expiry && "expiry date"
    ].filter(Boolean);

    $("eccOcrStatus").textContent =
      missing.length
        ? (
          "OCR completed. Check or correct: " +
          missing.join(", ") +
          "."
        )
        : (
          "OCR completed automatically. " +
          "Please confirm the details against the card."
        );

    eccDateStatus();
    saveForm();
    updateCompletion();

  } catch (err) {
    $("eccOcrStatus").textContent =
      `OCR failed: ${err.message}. ` +
      "Check the extracted fields manually.";

    eccDateStatus();
    updateCompletion();
  }
}

// Keep manual correction available when OCR is uncertain.

for (
  const [id, prop] of [
    ["eccName", "eccName"],
    ["eccNumber", "eccNumber"],
    ["eccExpiry", "eccExpiry"]
  ]
) {
  $(id).addEventListener(
    "input",
    () => {
      state[prop] = $(id).value;

      eccDateStatus();
      saveForm();
      updateCompletion();
    }
  );
}

// =====================================================
// 15. DOCUMENT CAPTURE BUTTONS
// =====================================================

$("captureEccBtn").addEventListener(
  "click",
  () => openRear({
    type: "ecc",
    title: "Capture ECC card",
    help:
      "Keep the name, ECC number and expiry date in focus."
  })
);

$("captureSfaBtn").addEventListener(
  "click",
  () => openRear({
    type: "sfa",
    title: "Capture SFA licence",
    help:
      "Capture the entire SFA licence clearly. " +
      "No OCR is required."
  })
);

// =====================================================
// 16. AUDIT AREA UI
// =====================================================

function renderAreas() {
  const container =
    $("sectionsContainer");

  container.replaceChildren();

  for (const area of AREAS) {
    const frag =
      $("sectionTemplate")
        .content
        .cloneNode(true);

    const article =
      frag.querySelector(
        ".audit-section"
      );

    article.dataset.section =
      area.id;

    article.querySelector(
      "h3"
    ).textContent = area.name;

    article.querySelector(
      ".section-help"
    ).textContent = area.help;

    article.querySelector(
      ".capture-shot-btn"
    ).addEventListener(
      "click",
      () => openRear({
        type: "area",
        id: area.id,
        title: area.name,
        help: area.help,
        guide: area.guide
      })
    );

    const toggle =
      article.querySelector(
        ".section-toggle-btn"
      );

    toggle.addEventListener(
      "click",
      () => {
        const collapsed =
          article.classList.toggle(
            "collapsed"
          );

        toggle.setAttribute(
          "aria-expanded",
          String(!collapsed)
        );
      }
    );

    container.appendChild(frag);
  }
}

function showArea(
  id,
  autoCollapse = true
) {
  const article =
    document.querySelector(
      `.audit-section[data-section="${id}"]`
    );

  if (!article) return;

  const rec =
    state.photos[id];

  const preview =
    article.querySelector(
      ".mini-preview"
    );

  preview.replaceChildren();

  if (rec) {
    const img =
      document.createElement("img");

    img.src = rec.imageDataUrl;
    img.alt = `${id} photograph`;

    preview.appendChild(img);
  }

  article.querySelector(
    ".section-progress"
  ).textContent =
    rec ? "1/1" : "0/1";

  article.querySelector(
    ".capture-shot-btn"
  ).textContent =
    rec
      ? "Retake photograph"
      : "Take photograph";

  if (
    rec &&
    autoCollapse
  ) {
    article.classList.add(
      "collapsed"
    );

    article.querySelector(
      ".section-toggle-btn"
    ).setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

// =====================================================
// 17. SHARED REAR-CAMERA DIALOG
// =====================================================

async function openRear(config) {
  if (!setupReady()) {
    alert(
      "Complete officer, premise and GPS first."
    );
    return;
  }

  if (!state.selfie) {
    alert(
      "Take your officer selfie first."
    );
    return;
  }

  if (state.active) return;

  state.active = config;

  $("dialogTitle").textContent =
    config.title;

  $("dialogHint").textContent =
    config.help;

  $("qualityMessage").textContent =
    "Hold steady and capture a clear image.";

  $("qualityMessage").className =
    "quality-message";

  $("auditOnionSkin").hidden =
    !config.guide;

  if (config.guide) {
    $("auditOnionSkin").src =
      config.guide;

  } else {
    $("auditOnionSkin").removeAttribute(
      "src"
    );
  }

  $("captureDialog").showModal();

  try {
    state.rearStream =
      await startCamera(
        $("auditCamera"),
        "environment"
      );

  } catch (err) {
    alert(
      `Rear camera unavailable: ${err.message}`
    );

    closeRear();
  }
}

function closeRear() {
  stopStream(state.rearStream);

  state.rearStream = null;

  $("auditCamera").srcObject =
    null;

  state.active = null;

  if ($("captureDialog").open) {
    $("captureDialog").close();
  }
}

$("closeDialogBtn").addEventListener(
  "click",
  closeRear
);

$("captureDialog").addEventListener(
  "cancel",
  e => {
    e.preventDefault();
    closeRear();
  }
);

// =====================================================
// 18. CAPTURE PHOTO
// =====================================================

$("captureAuditBtn").addEventListener(
  "click",
  async () => {
    const active =
      state.active;

    if (!active) return;

    $("captureAuditBtn").disabled =
      true;

    try {
      // Mandatory fresh GPS for each photo.
      const fresh =
        await getGPS();

      if (!validGPS(fresh)) {
        throw new Error(
          "Fresh GPS location required; please retry."
        );
      }

      const pic = snap(
        $("auditCamera"),
        $("auditCanvas")
      );

      const q =
        checkQuality(
          pic.canvas
        );

      if (!q.accept) {
        throw new Error(
          `${q.reason}. Please retake.`
        );
      }

      state.location = fresh;

      showGPS();
      saveForm();

      const rec = record(
        pic.imageDataUrl,

        active.type === "area"
          ? active.id
          : active.type,

        q
      );

      if (active.type === "ecc") {

        await putPhoto(
          "ecc",
          rec
        );

        state.eccPhoto = rec;

        // Clear values from previous ECC card.
        state.eccName = "";
        state.eccNumber = "";
        state.eccExpiry = "";

        state.eccOcrText = "";
        state.eccOcrDone = false;

        $("eccName").value = "";
        $("eccNumber").value = "";
        $("eccExpiry").value = "";

        imageIn(
          "eccPreview",
          rec
        );

        eccDateStatus();
        saveForm();

      } else if (
        active.type === "sfa"
      ) {

        await putPhoto(
          "sfa",
          rec
        );

        state.sfaPhoto = rec;

        imageIn(
          "sfaPreview",
          rec
        );

        $("sfaStatus").textContent =
          "SFA licence photo captured (no OCR).";

      } else {

        await putPhoto(
          `area:${active.id}`,
          rec
        );

        state.photos[active.id] =
          rec;

        showArea(active.id);
      }

      closeRear();
      updateCompletion();

      // ECC OCR starts automatically
      // after successfully capturing the card.
      if (active.type === "ecc") {
        await autoEccOCR();
      }

    } catch (err) {

      $("qualityMessage").textContent =
        `Photo not accepted: ${err.message}`;

      $("qualityMessage").className =
        "quality-message warn";

    } finally {
      $("captureAuditBtn").disabled =
        false;
    }
  }
);

// =====================================================
// 19. COMPLETION VALIDATION
// =====================================================

function updateCompletion() {
  const ready =
    setupReady();

  $("setupStatus").textContent =
    ready
      ? "Completed"
      : "Not completed";

  if (
    ready &&
    !state.setupWasComplete
  ) {
    collapse(
      "setupCard",
      "setupToggleBtn"
    );
  }

  state.setupWasComplete =
    ready;

  $("selfieStatus").textContent =
    state.selfie
      ? "Completed"
      : "Not completed";

  const eccComplete = Boolean(
    state.eccPhoto &&
    state.eccName.trim() &&
    state.eccNumber.trim() &&
    validDate(state.eccExpiry) &&
    state.eccExpiry >= todaySG()
  );

  const docsComplete =
    eccComplete &&
    Boolean(state.sfaPhoto);

  $("verificationStatus").textContent =
    docsComplete
      ? "Completed"
      : "Not completed";

  if (
    docsComplete &&
    !state.verificationWasComplete
  ) {
    collapse(
      "verificationCard",
      "verificationToggleBtn"
    );
  }

  state.verificationWasComplete =
    docsComplete;

  const count =
    Object.values(
      state.photos
    ).filter(Boolean).length;

  const missing = [];

  if (!state.officer) {
    missing.push("officer");
  }

  if (!premiseName()) {
    missing.push("premise");
  }

  if (!validGPS(state.location)) {
    missing.push("GPS");
  }

  if (!state.selfie) {
    missing.push("selfie");
  }

  if (!eccComplete) {
    missing.push(
      "ECC details and current expiry date"
    );
  }

  if (!state.sfaPhoto) {
    missing.push(
      "SFA licence photo"
    );
  }

  if (count !== AREAS.length) {
    missing.push(
      `${AREAS.length - count} audit photo(s)`
    );
  }

  $("downloadBtn").disabled =
    missing.length > 0;

  $("completionSummary").textContent =
    missing.length
      ? (
        `Not ready. Missing: ${missing.join(", ")}.\n` +
        `Audit areas captured: ${count}/6.`
      )
      : (
        "Ready to export.\n" +
        `Officer: ${officerName()}\n` +
        `Premise: ${premiseName()}\n` +
        "ECC: Valid (date check only)\n" +
        "SFA photo: Captured\n" +
        "Audit photos: 6/6"
      );
}

// =====================================================
// 20. JSON EXPORT
// =====================================================

$("downloadBtn").addEventListener(
  "click",
  () => {
    updateCompletion();

    if ($("downloadBtn").disabled) {
      return;
    }

    const data = {
      schemaVersion: "4.0",

      id:
        crypto.randomUUID?.() ||
        `audit-${Date.now()}`,

      exportedAt:
        new Date().toISOString(),

      officer: {
        id: state.officer,
        name: officerName()
      },

      premise: {
        name: premiseName(),
        selection: state.choice,
        assignmentSource:
          "Hardcoded mock-up"
      },

      startedAt: state.startedAt,

      initialLocation:
        state.initialLocation,

      currentLocation:
        state.location,

      selfie:
        state.selfie,

      ecc: {
        card: state.eccPhoto,
        name: state.eccName,
        number: state.eccNumber,
        expiry: state.eccExpiry,
        ocrText: state.eccOcrText,
        ocrCompleted: state.eccOcrDone,

        dateCheck:
          state.eccExpiry >= todaySG()
            ? "date-current"
            : "expired-or-unknown"
      },

      sfa: {
        licencePhoto:
          state.sfaPhoto,

        officialStatus:
          "not checked"
      },

      areas:
        state.photos,

      limitations: [
        "Mock-up only",
        "GPS/device time may be spoofed",
        "ECC OCR and date check do not verify official registration",
        "SFA licence is photographic evidence only",
        "Image sharpness check is heuristic"
      ]
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
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
      premiseName()
        .replace(
          /[^a-z0-9_-]+/gi,
          "-"
        )
        .slice(0, 70) +
      "-ESR.json";

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }
);

// =====================================================
// 21. RESET AUDIT
// =====================================================

async function resetAudit(reload = true) {
  stopStream(state.selfieStream);
  stopStream(state.rearStream);

  await clearPhotos();

  localStorage.removeItem(
    FORM_KEY
  );

  if (reload) {
    location.reload();
    return;
  }

  Object.assign(state, {
    officer: "",
    choice: "",
    other: "",
    startedAt: null,

    location: null,
    initialLocation: null,

    selfie: null,
    eccPhoto: null,
    sfaPhoto: null,

    eccName: "",
    eccNumber: "",
    eccExpiry: "",
    eccOcrText: "",
    eccOcrDone: false,

    photos: Object.fromEntries(
      AREAS.map(
        a => [a.id, null]
      )
    ),

    selfieStream: null,
    rearStream: null,
    active: null,

    setupWasComplete: false,
    verificationWasComplete: false
  });

  $("selfiePreview").replaceChildren();

  imageIn(
    "eccPreview",
    null
  );

  imageIn(
    "sfaPreview",
    null
  );

  $("eccPreview").textContent =
    "No ECC card captured";

  $("sfaPreview").textContent =
    "No SFA licence captured";

  for (const area of AREAS) {
    showArea(
      area.id,
      false
    );
  }

  $("eccName").value = "";
  $("eccNumber").value = "";
  $("eccExpiry").value = "";

  $("sfaStatus").textContent =
    "Awaiting SFA licence photograph.";

  $("eccOcrStatus").textContent =
    "Capture the ECC card to start automatic OCR.";

  eccDateStatus();
}

$("headerResetBtn").addEventListener(
  "click",
  async () => {
    if (!confirm(
      "Reset this audit and permanently clear the locally saved " +
      "form, selfie and all photographs?"
    )) {
      return;
    }

    $("headerResetBtn").disabled =
      true;

    try {
      await resetAudit();

    } catch (err) {
      alert(
        `Reset failed: ${err.message}`
      );

      $("headerResetBtn").disabled =
        false;
    }
  }
);

// =====================================================
// 22. INITIALISATION AND DRAFT RECOVERY
// =====================================================

async function init() {
  renderAreas();

  $("deviceStatus").textContent =
    `${navigator.platform || "Device"}` +
    (
      /Android|iPhone|iPad|Mobile/i.test(
        navigator.userAgent
      )
        ? " · mobile"
        : ""
    );

  restoreForm();

  // Restore images before allowing an officer
  // change that could mix evidence.
  try {
    state.selfie =
      await getPhoto("selfie") ||
      null;

    state.eccPhoto =
      await getPhoto("ecc") ||
      null;

    state.sfaPhoto =
      await getPhoto("sfa") ||
      null;

    for (const area of AREAS) {
      state.photos[area.id] =
        await getPhoto(
          `area:${area.id}`
        ) || null;
    }

  } catch (err) {
    console.warn(
      "Photo recovery unavailable:",
      err
    );

    $("draftStatus").textContent =
      "Photo recovery unavailable";
  }

  $("officerSelect").value =
    state.officer;

  if (
    state.officer &&
    !state.choice
  ) {
    state.choice =
      singaporeHour() < 12
        ? "am"
        : "pm";
  }

  showAssignment();
  showGPS();

  imageIn(
    "selfiePreview",
    state.selfie
  );

  imageIn(
    "eccPreview",
    state.eccPhoto
  );

  imageIn(
    "sfaPreview",
    state.sfaPhoto
  );

  if (!state.eccPhoto) {
    $("eccPreview").textContent =
      "No ECC card captured";
  }

  if (!state.sfaPhoto) {
    $("sfaPreview").textContent =
      "No SFA licence captured";
  }

  $("eccName").value =
    state.eccName;

  $("eccNumber").value =
    state.eccNumber;

  $("eccExpiry").value =
    state.eccExpiry;

  $("sfaStatus").textContent =
    state.sfaPhoto
      ? "SFA licence photo captured (no OCR)."
      : "Awaiting SFA licence photograph.";

  $("eccOcrStatus").textContent =
    state.eccOcrDone
      ? "ECC OCR completed. Review the extracted fields."
      : (
        state.eccPhoto
          ? "Card recovered; OCR will run automatically on retake."
          : "Capture the ECC card to start automatic OCR."
      );

  if (state.selfie) {
    $("startSelfieBtn").textContent =
      "Retake selfie";

    collapse(
      "selfieCard",
      "selfieToggleBtn"
    );
  }

  for (const area of AREAS) {
    showArea(area.id);
  }

  eccDateStatus();
  updateCompletion();

  if (!window.isSecureContext) {
    $("locationDetails").textContent =
      "Camera and GPS require HTTPS.";
  }

  // Keep date/time current without changing
  // a manually selected AM/PM premise.
  setInterval(
    () => {
      updateClock();
      eccDateStatus();
      updateCompletion();
    },
    30000
  );
}

init().catch(err => {
  console.error(err);

  alert(
    `ESR could not initialise: ${err.message}`
  );
});
