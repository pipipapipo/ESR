ESR Audit Capture — GitHub Pages static prototype
This is a client-side prototype for structured live-photo capture during ESR/TCI toilet audits.
What it does
Officer dropdown: Officer A / B / C
Mandatory premise name
Mandatory browser geolocation before capture
Front-facing live-camera officer selfie
Five audit sections:
Cubicles
General Area
Sink Area
Urinal Area
Miscellaneous
Two live-camera photos per section:
Overview
Close-up
Onion-skin / framing guides over the live camera
Basic client-side rejection for:
very dark images
severe overexposure
very low contrast / obstruction
obvious blur
Captures basic browser/device information
Exports a JSON audit package containing photos and capture metadata
Important limitations
1. "Live camera only"
The app does not expose a file-upload or gallery button. It uses `navigator.mediaDevices.getUserMedia()` and captures directly from the live video stream.
A determined user with a modified browser/device can still bypass client-side controls. A static website cannot provide forensic tamper-proofing.
2. Location
Location is mandatory in the UI and a fresh geolocation fix is requested before each audit photo is accepted.
Browser geolocation can be spoofed. For stronger integrity you need a backend that stores the server receive time, user identity, submission history and preferably a signed capture manifest.
3. Phone model
Modern browsers intentionally expose limited hardware details. The app records platform, mobile/desktop flag, user agent, screen size and pixel ratio. Exact phone model is often unavailable.
4. Semantic photo rejection
This static version can reject poor image quality, but it cannot reliably know whether the officer photographed a toilet bowl versus a chair.
To reject the wrong subject, add a computer-vision API or a browser ML model. The natural insertion point is in `captureAuditBtn` inside `app.js`, immediately after `assessImageQuality()` and before saving the capture record.
Deploy to GitHub Pages
Create a new GitHub repository.
Upload these files to the repository root:
`index.html`
`styles.css`
`app.js`
`README.md`
Open Settings → Pages.
Under Build and deployment, choose Deploy from a branch.
Select your main branch and `/ (root)`.
Save and wait for the GitHub Pages HTTPS URL.
Camera and geolocation APIs require a secure context. GitHub Pages HTTPS satisfies this requirement.
Suggested next step: add ML validation
A static frontend should not contain a secret API key. Add a small backend/serverless endpoint such as Azure Functions, Cloudflare Workers, Vercel Functions or AWS Lambda.
The browser can send the captured image plus expected section/shot:
```json
{
  "expectedSection": "cubicles",
  "expectedShot": "closeup",
  "image": "..."
}
```
The validator can return:
```json
{
  "accepted": true,
  "detectedComponent": "toilet_bowl",
  "confidence": 0.94,
  "reason": "Toilet bowl is clearly visible and occupies the central frame."
}
```
Possible validation rules:
Cubicle close-up: toilet bowl or squat pan must be visible
Sink close-up: wash basin / vanity must be visible
Urinal close-up: urinal must be visible
General-area overview: floor area should occupy most of frame
Miscellaneous close-up: litter bin / relevant amenity should be visible
Overview shots should show wider context than close-up shots
Only save a photo after the validator returns `accepted: true`.
Data warning
The exported JSON embeds photos as base64 data URLs and can therefore become large. For production, upload images individually to managed storage and store only their URLs/IDs in the audit record.
