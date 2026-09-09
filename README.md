# ShareFast (AirLink) • Fast Offline Peer-to-Peer File Sharing

A modern, production-quality peer-to-peer file sharing web application designed to transfer files directly between two nearby devices over local network/WebRTC with **no cloud upload, no accounts, and no external file storage servers**.

Combines the simplicity of **Apple AirDrop**, the speed of local network transfer, and the sleek modern aesthetic of **Linear**.

---

## 1. System Architecture

```text
                     ┌──────────────────────────────┐
                     │   Lightweight Node.js WS     │
                     │      Signaling Server        │
                     │  (Session, OTP, SDP Relay)   │
                     └──────▲────────────────▲──────┘
                            │                │
            1. Register /   │                │ 2. Scan QR or
               Create Session                │    Enter OTP
                            │                │
                     ┌──────▼──────┐  3. ICE / SDP   ┌─────────────┐
                     │   SENDER    ├─────────────────┤  RECEIVER   │
                     │  (Browser)  │   Exchange via  │  (Browser)  │
                     └──────┬──────┘    Signaling    └──────┬──────┘
                            │                               │
                            │   4. DIRECT WebRTC P2P        │
                            │      DataChannel Transfer     │
                            └───────────────────────────────►
                                 (Binary Chunks + SHA-256)
                                 (Zero Cloud Upload)
```

### Key Differentiators:
- **Zero Cloud Storage**: No file bytes ever touch the signaling server or any central database.
- **Direct WebRTC DataChannel**: Files are transferred point-to-point directly between browser instances over the local Wi-Fi, LAN, or mobile hotspot.
- **Backpressure & Flow Control**: Sends 64 KB binary frames with active `bufferedAmount` monitoring, ensuring browsers never choke or run out of memory when transferring large files (100 MB to 5 GB+).
- **Streaming Incremental SHA-256**: Hashes chunks progressively on both sender and receiver without loading entire multi-GB files into RAM.
- **Instant AirDrop-style UX**: Single-tap file selection, dynamic QR code pairing, 6-digit OTP fallback with brute-force rate-limiting, and automatic redirect directly to the receiving progress screen.
- **Offline PWA**: Installable web application shell cached offline via service worker.

---

## 2. Complete Folder Structure

```text
visuAL LINK/
├── apps/
│   ├── signaling/                    # High-performance Node.js WebSocket signaling server
│   │   ├── src/
│   │   │   └── server.ts             # Session lifecycle, OTP routing, rate limiting, SDP/ICE relay
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # Next.js 15 App Router Frontend
│       ├── app/
│       │   ├── globals.css           # Tailwind styles, glassmorphism, responsive variables
│       │   ├── layout.tsx            # PWA headers, metadata, Navbar, ServiceWorker register
│       │   ├── page.tsx              # Minimalist Home screen (Send & Receive cards)
│       │   ├── send/
│       │   │   └── page.tsx          # Sender workflow (Picker -> QR/OTP -> Transfer -> Complete)
│       │   └── receive/
│       │       └── page.tsx          # Receiver workflow (QR Scan / OTP -> Transfer -> Save File)
│       ├── components/
│       │   ├── Navbar.tsx            # Header with status pills and theme toggle
│       │   ├── ThemeToggle.tsx       # Light / Dark mode toggle
│       │   ├── FilePicker.tsx        # Drag & drop area with image previews & metadata
│       │   ├── QRDisplay.tsx         # Crisp SVG QR code, 6-digit OTP, countdown, copy actions
│       │   ├── QRScanner.tsx         # Camera QR scanner with reticle laser, torch, camera switch
│       │   ├── OTPInput.tsx          # 6-box OTP entry with auto-focus, paste, and rate limit errors
│       │   ├── TransferProgress.tsx  # Live progress bar, rolling speed (MB/s), ETA, cancel
│       │   ├── CompleteScreen.tsx    # Confetti celebration, speed stats, SHA-256 integrity, Save
│       │   └── ServiceWorkerRegister.tsx
│       ├── lib/
│       │   ├── signaling/
│       │   │   └── client.ts         # Resilient typed WebSocket client
│       │   ├── webrtc/
│       │   │   └── peer.ts           # RTCPeerConnection wrapper with queued ICE handling
│       │   ├── transfer/
│       │   │   ├── sender.ts         # Sliced chunk reader with backpressure flow control
│       │   │   └── receiver.ts       # Binary chunk accumulator and integrity verification
│       │   └── utils/
│       │       └── format.ts         # Byte, speed, and time formatters
│       ├── public/
│       │   ├── manifest.json         # PWA web app manifest
│       │   ├── sw.js                 # Service worker for offline shell caching
│       │   ├── icon-192.png
│       │   ├── icon-512.png
│       │   └── icon.svg
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── protocol/                     # Shared protocol types, message schemas, constants
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── crypto/                       # Crypto token/OTP generation, 13B binary framing, SHA-256
│       ├── src/index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── tests/
│   ├── unit-test.mjs                 # Unit tests for binary packet framing, OTP, SHA-256
│   └── e2e-signaling-test.mjs        # End-to-end integration test for signaling & rate-limiting
│
├── .gitignore
├── .npmrc
├── package.json                      # Root workspace scripts (dev, build, start, test)
├── pnpm-workspace.yaml               # PNPM workspace definition
└── README.md
```

---

## 3. Environment Variables

Create `.env.local` or pass environment variables at runtime:

### Web Frontend (`apps/web/.env.local`):
```env
# Optional: URL of signaling server (defaults to ws://<current-host>:4000)
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4000
NEXT_PUBLIC_SIGNALING_PORT=4000
```

### Signaling Server (`apps/signaling/.env`):
```env
# Port on which the signaling server listens
SIGNALING_PORT=4000
PORT=4000
HOST=0.0.0.0
```

---

## 4. Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ / v24+ recommended)
- **pnpm**: v9.0.0 or later (v11+ recommended)

```bash
# Clone the repository
git clone https://github.com/your-username/sharefast.git
cd sharefast

# Install all workspace dependencies
pnpm install
```

---

## 5. Development Commands

Run both the Signaling Server and Next.js Web App concurrently:

```bash
pnpm dev
```

Or run them individually in separate terminals:

```bash
# Terminal 1: Start Signaling Server on port 4000
pnpm dev:signaling

# Terminal 2: Start Next.js Frontend on port 3000
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Production Deployment Instructions

### Build All Workspaces
```bash
pnpm build
```

### Run in Production
```bash
pnpm start
```
- The signaling server runs on `http://0.0.0.0:4000`
- The Next.js frontend runs on `http://0.0.0.0:3000`

### Docker Deployment (Optional)
Deploying with Docker or containerized environments:
- Expose port `3000` (Next.js web) and `4000` (WebSocket signaling).
- When deploying to HTTPS/WSS behind a reverse proxy (e.g., Nginx, Caddy, Cloudflare), set `NEXT_PUBLIC_SIGNALING_URL=wss://your-domain.com/signaling` and proxy `/signaling` to port `4000`.

---

## 7. Automated Testing

Run the comprehensive test suite (unit tests + end-to-end signaling handshake test):

```bash
pnpm test
```

### What is tested:
1. **Cryptographic Token & OTP Generation**: 32-character hex tokens, unbiased 6-digit numeric OTPs.
2. **Binary Chunk Header Framing**: Correct 13-byte header encoding (`type: 1B`, `transferIdHash: 4B`, `chunkIndex: 4B`, `chunkSize: 4B`) and zero-copy slicing.
3. **Streaming Incremental SHA-256**: Compares the streaming hasher byte-for-byte against Node's native `crypto.createHash('sha256')`.
4. **Signaling Server Lifecycle**:
   - HTTP `/health` check.
   - Session creation with 10-minute automated expiration.
   - Rate-limiting: brute-force OTP attempts blocked after 5 attempts.
   - Successful pairing between Sender and Receiver.
   - SDP Offer/Answer relay.
   - Trickle ICE candidate relay.

---

## 8. Manual Testing Across Two Devices / Windows

### Local Testing (Same Machine, Two Browser Tabs)
1. Open [http://localhost:3000/send](http://localhost:3000/send) in Tab A.
2. Select any file (e.g. an image, video, or zip).
3. Copy the 6-digit pairing code or copy the share link.
4. Open [http://localhost:3000/receive](http://localhost:3000/receive) in Tab B (or paste the share link).
5. Enter the 6-digit code and click **Connect**.
6. Watch both tabs transition immediately to the **Transfer Progress** screen with live MB/s speed and rolling ETA.
7. Upon completion, verify the green **File verified successfully** badge and click **Save / Download File**.

### LAN / Wi-Fi Testing (Two Phones / Laptop & Phone)
1. Find your host computer's local IP address (`ipconfig` on Windows, e.g., `192.168.1.50`).
2. Run `pnpm dev` on your host machine.
3. On Phone A (Sender): Open `http://192.168.1.50:3000/send`. Pick a file.
4. On Phone B (Receiver): Open `http://192.168.1.50:3000/receive`.
5. Tap **Scan QR** and scan the QR code displayed on Phone A (or enter the 6-digit code).
6. WebRTC negotiates a direct LAN connection between both devices without routing file data to the internet.

---

## 9. Performance Testing Procedure (100 MB, 1 GB, and 5 GB+)

To test high-speed large file transfers without third-party tools, create test files of exact sizes:

```powershell
# In PowerShell: Generate 100 MB test file
fsutil file createnew test-100mb.bin 104857600

# Generate 1 GB test file
fsutil file createnew test-1gb.bin 1073741824
```

### Test Steps:
1. Select `test-100mb.bin` or `test-1gb.bin` in the **Send** screen.
2. Connect from the **Receive** screen.
3. Observe:
   - **Throughput**: On typical 5GHz Wi-Fi or LAN, transfers achieve between **20 MB/s to 65 MB/s**.
   - **Memory Usage**: Inspect Chrome Task Manager (`Shift + Esc`). Notice memory does **not** jump by 1 GB because the file is sliced in 64 KB slices on demand rather than buffering the entire file into JavaScript memory.
   - **Backpressure**: The transfer smoothly throttles whenever the internal WebRTC buffer exceeds 4 MB and resumes immediately on `bufferedamountlow`.
   - **Verification**: SHA-256 fingerprint verified upon final byte arrival.

---

## 10. Browser Compatibility & Platform Limitations

| Browser / Platform | Support | Notes |
| :--- | :---: | :--- |
| **Google Chrome (Desktop & Android)** | Full | Best performance, hardware-accelerated WebRTC, camera scanner support. |
| **Microsoft Edge** | Full | Identical to Chrome (Chromium engine). |
| **Mozilla Firefox** | Full | Supports DataChannel binary transfers, media streams, and WebRTC. |
| **Apple Safari (iOS & macOS)** | Full | Camera scanner requires HTTPS or localhost for getUserMedia permissions. |

### Technical Limitations & Clarifications
1. **Physical Communication Path Required**:
   A web browser cannot transmit data between two physically air-gapped devices with literally zero networking medium (Wi-Fi, hotspot, or Ethernet). The app operates without cloud file storage by establishing direct local peer-to-peer transport over local network/WebRTC.
2. **Camera Permissions**:
   The QR scanner uses browser `navigator.mediaDevices.getUserMedia`. Modern browsers enforce that camera access is restricted to secure origins (`https://` or `localhost`). If running over plain `http://<lan-ip>`, use the 6-digit OTP code fallback.
3. **Session Expiry**:
   Unpaired sessions automatically expire after 10 minutes, and pairing OTPs are strictly single-use to prevent replay attacks.
