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

const state = {
  location: null,
  device: {},
  selfie: null,
  sections: Object.fromEntries(SECTION_CONFIG.map(s => [s.id, { overview: null, closeup: null }])),
  selfieStream: null,
  auditStream: null,
  activeCapture: null
};

const $ = (id) => document.getElementById(id);
const officerSelect = $("officerSelect");
const premiseInput = $("premiseInput");
const locationBtn = $("locationBtn");
const locationStatus = $("locationStatus");
const locationDetails = $("locationDetails");
const deviceStatus = $("deviceStatus");
const camera = $("camera");
const auditCamera = $("auditCamera");
const captureCanvas = $("captureCanvas");
const auditCanvas = $("auditCanvas");
const startSelfieBtn = $("startSelfieBtn");
const captureSelfieBtn = $("captureSelfieBtn");
const selfiePreview = $("selfiePreview");
const sectionsContainer = $("sectionsContainer");
const template = $("sectionTemplate");
const captureDialog = $("captureDialog");
const dialogTitle = $("dialogTitle");
const dialogHint = $("dialogHint");
const auditOverlay = $("auditOverlay");
const auditOnionSkin = $("auditOnionSkin");
const setupCard = $("setupCard");
const setupToggleBtn = $("setupToggleBtn");
const setupStatus = $("setupStatus");

const selfieCard = $("selfieCard");
const selfieToggleBtn = $("selfieToggleBtn");
const selfieStatus = $("selfieStatus");
const qualityMessage = $("qualityMessage");
const captureAuditBtn = $("captureAuditBtn");
const closeDialogBtn = $("closeDialogBtn");
const completionSummary = $("completionSummary");
const downloadBtn = $("downloadBtn");
const resetBtn = $("resetBtn");

init();

async function init() {
  renderSections();
  detectDevice();
  updateCompletion();

  if (!window.isSecureContext) {
    locationDetails.textContent = "Camera and geolocation require HTTPS. GitHub Pages provides HTTPS.";
  }
}

function detectDevice() {
  const ua = navigator.userAgent || "Unknown";
  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  const mobile = navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(ua);
  state.device = {
    platform,
    mobile,
    userAgent: ua,
    screen: `${screen.width}x${screen.height}`,
    pixelRatio: window.devicePixelRatio || 1
  };

  // Browsers generally do not expose an exact phone model for privacy reasons.
  deviceStatus.textContent = `${platform}${mobile ? " · mobile" : ""}`;
}

function renderSections() {
  sectionsContainer.innerHTML = "";

  for (const section of SECTION_CONFIG) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector(".audit-section");
    article.dataset.section = section.id;
    article.querySelector("h3").textContent = section.name;
    article.querySelector(".section-help").textContent = section.help;

    const toggleBtn = article.querySelector(".section-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      const collapsed = article.classList.toggle("collapsed");
      toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    });

    article.querySelectorAll(".capture-item").forEach(item => {
      const shot = item.dataset.shot;
      const btn = item.querySelector(".capture-shot-btn");
      btn.addEventListener("click", () => openAuditCapture(section.id, shot));
    });

    sectionsContainer.appendChild(node);
  }
}

locationBtn.addEventListener("click", requestLocation);

function requestLocation() {
  if (!navigator.geolocation) {
    setLocationFailure("Geolocation is not supported on this device.");
    return;
  }

  locationStatus.textContent = "Locating…";
  locationStatus.className = "badge bad";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        capturedAt: new Date(pos.timestamp).toISOString()
      };
      locationStatus.textContent = "Location ready";
      locationStatus.className = "badge good";
      locationDetails.textContent = `Accuracy: ±${state.location.accuracyM} m · captured ${new Date().toLocaleTimeString()}`;
      updateCompletion();
    },
    (err) => setLocationFailure(`Location required: ${err.message}`),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function setLocationFailure(message) {
  state.location = null;
  locationStatus.textContent = "Unavailable";
  locationStatus.className = "badge bad";
  locationDetails.textContent = message;
  updateCompletion();
}


selfieToggleBtn.addEventListener("click", () => {
  const collapsed = selfieCard.classList.toggle("collapsed");
  selfieToggleBtn.setAttribute("aria-expanded", String(!collapsed));
});

startSelfieBtn.addEventListener("click", async () => {
  if (!state.location) return alert("Enable location before taking the selfie.");
  await stopStream(state.selfieStream);
  try {
    state.selfieStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    camera.srcObject = state.selfieStream;
    captureSelfieBtn.disabled = false;
  } catch (err) {
    alert(`Unable to access front camera: ${err.message}`);
  }
});

captureSelfieBtn.addEventListener("click", async () => {
  if (!state.location) return alert("Location is required.");
  const captured = await captureFromVideo(camera, captureCanvas);
  const quality = assessImageQuality(captured.canvas);
  if (!quality.accept) {
    alert(`Please retake the selfie: ${quality.reason}`);
    return;
  }

  state.selfie = makeCaptureRecord(captured.dataUrl, "selfie", "selfie", quality);
  selfiePreview.innerHTML = `<img src="${captured.dataUrl}" alt="Officer selfie" />`;
  await stopStream(state.selfieStream);
  state.selfieStream = null;
  camera.srcObject = null;
  captureSelfieBtn.disabled = true;
  selfieStatus.textContent = "Completed";
  startSelfieBtn.textContent = "Retake selfie";
  selfieCard.classList.add("collapsed");
  selfieToggleBtn.setAttribute("aria-expanded", "false");
  updateCompletion();
});

async function openAuditCapture(sectionId, shot) {
  if (!state.location) return alert("Location is mandatory before taking audit photos.");
  if (!state.selfie) return alert("Take the officer selfie first.");
  if (!officerSelect.value || !premiseInput.value.trim()) return alert("Select the audit officer and enter the premise name first.");

  const section = SECTION_CONFIG.find(s => s.id === sectionId);
  state.activeCapture = { sectionId, shot };

  dialogTitle.textContent = `${section.name} — ${shot === "overview" ? "Overview" : "Close-up"}`;
  dialogHint.textContent = shot === "overview" ? section.help : section.closeupHint;
  auditOnionSkin.src = section.onionSkin;
  auditOnionSkin.onerror = () => {
    qualityMessage.textContent = `Guide image not found: ${section.onionSkin}. Camera capture can continue.`;
    qualityMessage.className = "quality-message warn";
  };
  auditOnionSkin.onload = () => {
    qualityMessage.textContent = "Align the live image as closely as possible with the example guide.";
    qualityMessage.className = "quality-message";
  };
  qualityMessage.textContent = "Align the live image as closely as possible with the example guide.";
  qualityMessage.className = "quality-message";

  captureDialog.showModal();
  await startAuditCamera();
}

async function startAuditCamera() {
  await stopStream(state.auditStream);
  try {
    state.auditStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1440 }
      },
      audio: false
    });
    auditCamera.srcObject = state.auditStream;
  } catch (err) {
    alert(`Unable to access rear camera: ${err.message}`);
    captureDialog.close();
  }
}

captureAuditBtn.addEventListener("click", async () => {
  if (!state.activeCapture || !state.location) return;

  // Require a fresh location fix close to capture time.
  const freshLocation = await getFreshLocation();
  if (!freshLocation) return alert("Could not obtain a fresh location fix. Photo was not accepted.");
  state.location = freshLocation;

  const captured = await captureFromVideo(auditCamera, auditCanvas);
  const quality = assessImageQuality(captured.canvas);
  if (!quality.accept) {
    qualityMessage.textContent = `Rejected: ${quality.reason}`;
    qualityMessage.className = "quality-message warn";
    return;
  }

  const { sectionId, shot } = state.activeCapture;

  // Browser-only validation can check blur/exposure but cannot reliably identify toilet fixtures.
  // If you add a vision API later, call it here before accepting the photo.
  const record = makeCaptureRecord(captured.dataUrl, sectionId, shot, quality);
  state.sections[sectionId][shot] = record;

  refreshSectionUI(sectionId);
  qualityMessage.textContent = "Accepted.";
  qualityMessage.className = "quality-message ok";

  await stopStream(state.auditStream);
  state.auditStream = null;
  auditCamera.srcObject = null;
  captureDialog.close();
  state.activeCapture = null;
  updateCompletion();
});

closeDialogBtn.addEventListener("click", closeCaptureDialog);
captureDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeCaptureDialog();
});

async function closeCaptureDialog() {
  await stopStream(state.auditStream);
  state.auditStream = null;
  auditCamera.srcObject = null;
  state.activeCapture = null;
  captureDialog.close();
}

function refreshSectionUI(sectionId) {
  const article = document.querySelector(`.audit-section[data-section="${sectionId}"]`);
  const sectionState = state.sections[sectionId];
  let count = 0;

  ["overview", "closeup"].forEach(shot => {
    const item = article.querySelector(`.capture-item[data-shot="${shot}"]`);
    const preview = item.querySelector(".mini-preview");
    const btn = item.querySelector(".capture-shot-btn");
    const record = sectionState[shot];

    if (record) {
      count++;
      preview.innerHTML = `<img src="${record.imageDataUrl}" alt="${sectionId} ${shot}" />`;
      btn.textContent = `Retake ${shot}`;
    } else {
      preview.innerHTML = "";
      btn.textContent = `Take ${shot}`;
    }
  });

  article.querySelector(".section-progress").textContent = `${count}/2`;

  if (count === 2) {
    article.classList.add("collapsed");
    const toggleBtn = article.querySelector(".section-toggle-btn");
    toggleBtn.setAttribute("aria-expanded", "false");
  }
}

async function captureFromVideo(video, canvas) {
  if (!video.videoWidth || !video.videoHeight) throw new Error("Camera is not ready.");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { canvas, dataUrl: canvas.toDataURL("image/jpeg", 0.9) };
}

function assessImageQuality(canvas) {
  const maxSize = 420;
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.floor(canvas.width * scale));
  const h = Math.max(1, Math.floor(canvas.height * scale));
  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d", { willReadFrequently: true });
  tctx.drawImage(canvas, 0, 0, w, h);
  const { data } = tctx.getImageData(0, 0, w, h);

  let sum = 0;
  let sumSq = 0;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    sum += g;
    sumSq += g * g;
  }
  const mean = sum / gray.length;
  const variance = sumSq / gray.length - mean * mean;

  // Simple edge-energy estimate. Low values usually indicate blur / obstruction.
  let edgeEnergy = 0;
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const lap = Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
      edgeEnergy += lap;
      edgeCount++;
    }
  }
  edgeEnergy /= Math.max(1, edgeCount);

  if (mean < 35) return { accept: false, reason: "image is too dark", brightness: mean, contrast: variance, sharpness: edgeEnergy };
  if (mean > 235) return { accept: false, reason: "image is heavily overexposed", brightness: mean, contrast: variance, sharpness: edgeEnergy };
  if (variance < 180) return { accept: false, reason: "image has very low contrast / may be obstructed", brightness: mean, contrast: variance, sharpness: edgeEnergy };
  if (edgeEnergy < 7) return { accept: false, reason: "image appears blurry; hold the phone steady and retake", brightness: mean, contrast: variance, sharpness: edgeEnergy };

  return { accept: true, reason: "basic quality checks passed", brightness: mean, contrast: variance, sharpness: edgeEnergy };
}

function makeCaptureRecord(imageDataUrl, section, shot, quality) {
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

function getFreshLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        capturedAt: new Date(pos.timestamp).toISOString()
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function allAuditPhotosComplete() {
  return SECTION_CONFIG.every(s => state.sections[s.id].overview && state.sections[s.id].closeup);
}

function updateCompletion() {
  const missing = [];
  if (!officerSelect.value) missing.push("officer");
  if (!premiseInput.value.trim()) missing.push("premise name");
  if (!state.location) missing.push("location");
  if (!state.selfie) missing.push("officer selfie");

  let photoCount = 0;
  for (const s of SECTION_CONFIG) {
    if (state.sections[s.id].overview) photoCount++;
    if (state.sections[s.id].closeup) photoCount++;
  }
  if (!allAuditPhotosComplete()) missing.push(`${10 - photoCount} audit photo(s)`);

  if (missing.length) {
    completionSummary.textContent = `Not ready. Missing: ${missing.join(", ")}.`;
    downloadBtn.disabled = true;
  } else {
    completionSummary.textContent = `Ready to export.\nOfficer: ${officerSelect.value}\nPremise: ${premiseInput.value.trim()}\nAudit photos: ${photoCount}/10\nLocation: captured`;
    downloadBtn.disabled = false;
  }
}

officerSelect.addEventListener("change", updateCompletion);
premiseInput.addEventListener("input", updateCompletion);

downloadBtn.addEventListener("click", async () => {
  if (downloadBtn.disabled) return;

  const auditId = crypto.randomUUID?.() || `audit-${Date.now()}`;
  const packageData = {
    schemaVersion: "1.0",
    auditId,
    exportedAt: new Date().toISOString(),
    officer: officerSelect.value,
    premiseName: premiseInput.value.trim(),
    device: state.device,
    initialLocation: state.location,
    selfie: state.selfie,
    sections: state.sections,
    notes: {
      captureMethod: "getUserMedia live camera; no gallery upload control is exposed",
      limitations: [
        "Browser geolocation can be spoofed and should not be treated as tamper-proof without server-side controls.",
        "Exact phone model is usually not exposed by modern browsers.",
        "Client-side quality checks detect blur/exposure only; semantic fixture validation requires an ML/vision service."
      ]
    }
  };

  // Add a digest of the metadata for accidental-change detection. This is not a secure signature.
  const canonical = JSON.stringify({ ...packageData, selfie: undefined, sections: stripImageData(state.sections) });
  packageData.metadataSha256 = await sha256(canonical);

  const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(premiseInput.value)}-${new Date().toISOString().slice(0,10)}-audit.json`;
  a.click();
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Reset this audit and remove all captured photos?")) return;
  await stopStream(state.selfieStream);
  await stopStream(state.auditStream);
  location.reload();
});

function stripImageData(sections) {
  const output = {};
  for (const [section, shots] of Object.entries(sections)) {
    output[section] = {};
    for (const [shot, rec] of Object.entries(shots)) {
      if (!rec) output[section][shot] = null;
      else {
        const { imageDataUrl, ...rest } = rec;
        output[section][shot] = rest;
      }
    }
  }
  return output;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function sanitizeFilename(value) {
  return (value || "premise").trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "premise";
}

async function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
}
