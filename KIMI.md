# KIMI.md

## Project purpose

This is **The Tao of LoRaWAN**, an approximately 30-minute, 18-slide HTML masterclass for a mixed engineering, marketing, sales, and support audience. It is a presentation, not a conventional scrolling website.

The central story is:

> An engineering question became a technology. The technology attracted an ecosystem. Products enabled other people to participate. Communities turned connectivity into shared infrastructure. The next value will be created by people the original builders have never met.

The deck includes three distinctive interactive/visual moments that should be preserved unless the user explicitly asks to change them:

- Slide 9: an animated network graph.
- Slide 15: a real MeshCore Public-channel demonstration over WebBluetooth.
- Slide 17: a Three.js brain model with activity travelling along real model edges.

The Elon Musk sink photograph on slide 10 is also intentional.

## Working principles for future edits

- Preserve the existing visual system and interaction model unless a redesign is explicitly requested.
- Treat on-slide copy and presenter notes as authored content, not filler. Do not casually rewrite the narrative.
- Keep the presentation readable at projection sizes and usable on mobile.
- Do not add a framework, bundler, package manager, backend, or build step. The project deliberately uses plain HTML, CSS, and JavaScript modules.
- Keep runtime assets local. Three.js, OBJLoader, images, and the brain model do not require a CDN; typography uses system font stacks.
- Never invent a live MeshCore reply or present the example transcript as a live connection.
- Do not create MeshCore channels, handle secrets, or introduce private-channel/zero-secret/example-secret flows.
- Update `assets/CREDITS.md` when adding or replacing third-party assets.
- After changes, test the affected slides at desktop and mobile sizes, not just the source code.

## Run locally

From this directory:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

Deep links use slide numbers, for example:

```text
http://localhost:8000/#6
http://localhost:8000/#15
```

Do not open `index.html` through `file://`. JavaScript modules and the OBJ model load require an HTTP origin.

## Deploy

This is a fully static site. Copy the entire contents of this directory to any static web host and serve the directory containing `index.html` as the document root.

There is:

- no compilation;
- no `npm install`;
- no server-side application;
- no database;
- no environment configuration;
- no required server rewrite rule.

`.git/` and this guide are useful in the source project but are not required at runtime.

For ordinary slides, either HTTP or HTTPS works. **For the live MeshCore demo, use HTTPS or `localhost`.** WebBluetooth requires a secure context and a user gesture. A plain HTTP LAN address such as `http://192.168.x.x` is not a secure context for this purpose.

Use a WebBluetooth-capable Chrome or Edge browser on a supported device for the live demo. Other browsers can still show the deck and the clearly labelled example transcript.

## Project structure

```text
app/
├── index.html                 All 18 slides, controls, dialogs, import map, presenter notes
├── notes.html                 Dedicated, large-font, scrollable presenter-notes page
├── KIMI.md                    This development and maintenance guide
├── src/
│   ├── styles.css             Complete visual system, notes-page styling, responsive/projection rules
│   ├── main.js                Navigation, notes dialog, overview, SVG graph, MeshCore UI wiring
│   ├── presenter-notes.js     Builds notes.html by reading the slide templates from index.html
│   ├── meshcore.js            MeshCore WebBluetooth client and companion-protocol handling
│   ├── fly-brain.js           Lazy Three.js scene, model loading, signals, fallback
│   └── ambient.js             Deterministic ambient ripple canvas
└── assets/
    ├── CREDITS.md             Third-party model, library, and photograph credits
    ├── amsterdam.jpg
    ├── calgary-field.jpg
    ├── laiier-severn-wld.png
    ├── mido-catanzaro.jpg
    ├── mythical-man-month.jpg
    ├── rak811.png
    ├── sink.jpg
    ├── vfb-banc-brain.obj      Official Virtual Fly Brain model
    ├── vfb-banc-brain.png     Static fallback image
    └── vendor/
        ├── three.module.min.js
        ├── three.core.min.js
        ├── OBJLoader.js
        └── THREE-LICENSE.txt
```

`index.html` maps the `three` import specifier to the vendored Three.js module:

```html
<script type="importmap">
  { "imports": { "three": "./assets/vendor/three.module.min.js" } }
</script>
```

Keep all three vendored Three.js files together. Do not replace only one of them with an unrelated release.

The stylesheet and main module use query-string cache versions, currently similar to:

```html
<link rel="stylesheet" href="./src/styles.css?v=23">
<script type="module" src="./src/main.js?v=19"></script>
```

Increment these versions when changing the corresponding files if browser or static-host caching could preserve an older revision.

## Deck architecture

Slides are full-viewport, absolutely positioned `<section>` elements inside `<main id="deck">`:

```html
<section
  class="slide slide--light slide--work"
  data-theme="light"
  data-title="Slide title"
  data-kicker="ACT · SECTION · TARGET TIME"
  aria-hidden="true"
>
  <div class="slide-inner ...">...</div>
  <template class="speaker-notes">Presenter notes...</template>
</section>
```

Important behaviour in `src/main.js`:

- Slides are discovered dynamically with `document.querySelectorAll(".slide")`.
- Only the current slide has the `active` class.
- Inactive slides receive `aria-hidden="true"` and `inert`.
- Navigation updates the progress bar, counter, title, kicker, document title, overview state, and URL hash.
- The overview is generated from the slides at startup.
- Presenter notes are read from the active slide's `template.speaker-notes` and inserted with `textContent`.
- Hash links use `#1` through `#18`; no server-side routes exist.
- Horizontal touch swipes navigate, while controls, dialogs, text areas, links, and the live transcript are excluded.

### Controls

| Input | Action |
| --- | --- |
| Right arrow, down arrow, Space, Page Down | Next slide |
| Left arrow, up arrow, Page Up | Previous slide |
| Home / End | First / last slide |
| `N` | Open or close speaker notes |
| `O` | Open or close slide overview |
| `F` | Enter or leave fullscreen |
| Horizontal swipe | Previous / next slide |

Keyboard shortcuts do not fire while the user is typing in an input, textarea, or editable element.

### Dedicated presenter-notes page

`notes.html` is a separate, scrollable page for a presenter screen. Open it directly at:

```text
./notes.html
```

It is also linked from the desktop deck header as **All notes** and from the slide-specific notes dialog as **Open all presenter notes**.

Important behaviour:

- The page fetches and parses `index.html`, then builds one numbered section per slide.
- The notes templates remain the single source of truth; do not duplicate presenter notes into `notes.html`.
- Every section has a stable anchor in the form `#slide-01` through `#slide-18`.
- The jump navigation links to those anchors within `notes.html`.
- Every section has an **Open slide N in the deck** link back to `index.html#N`.
- Presenter copy is intentionally large, with a desktop size around 33px and a smaller mobile size.
- The page supports ordinary scrolling, mobile use, and print output.
- All generated note content uses `textContent`; do not render fetched or user-controlled content as HTML.

When adding, removing, or renaming slides, `presenter-notes.js` should pick up the changes automatically. Test `notes.html`, the header link, the notes-dialog link, and the generated anchors after a slide-order change.

### Current slide map

1. The Tao of LoRaWAN
2. The route that brought me here
3. Farther, not faster
4. The first idea was not the final market
5. A radio is not an ecosystem
6. Open enough to build
7. Amsterdam, before the console
8. Why people build networks
9. Coverage enables growth; people create it — `#network-map`
10. Let that sink in — sink photograph
11. Connectivity is not the outcome — LAIIER and MiDo photographs
12. Support is where the next product is found
13. We did it ourselves
14. Somewhere beyond this room
15. Connection, demonstrated — MeshCore interface
16. Someone made this possible
17. The next builder is unknown — Three.js brain
18. Know what not to break

### Adding, removing, or reordering slides

- Move the entire `<section class="slide ...">...</section>` block, including its speaker-notes template.
- Preserve unique `data-title` values and meaningful `data-kicker` values.
- The counter and overview are generated dynamically, but update the hard-coded initial `01 / 18` counter in the footer if the total changes so the first paint is correct.
- If moving slides 9, 15, or 17, do not rename their layout classes or element IDs. `main.js` locates their behaviour through those hooks.
- Check every affected hash link and any documentation that refers to a slide number.

## Styling and responsive behaviour

`src/styles.css` is the single visual source of truth. It contains the base design system followed by several intentional refinement passes. Later rules can override earlier ones, so inspect the whole cascade before changing typography or spacing.

Core tokens include:

- `--navy`, `--navy-deep`: dark slide backgrounds.
- `--gold`, `--cream`: emphasis and highlights.
- `--paper`: light slide background.
- `--ink`, `--muted`: light-slide typography.
- `--display`: system serif stack for presentation headlines.
- `--sans`: system sans-serif stack for interface and body text.
- `--header-h`, `--nav-h`: fixed chrome dimensions.

No webfont is downloaded. Appearance depends on the available system fonts, with Georgia/Palatino-style and Helvetica/Arial-style fallbacks.

### Layout conventions

- `.slide-inner` provides the projection-safe content area.
- `.slide--dark`, `.slide--light`, and `data-theme` coordinate slide and header/footer colours.
- `.reveal` controls entrance animation for slide content.
- Most slide families have named layouts such as `.work-layout`, `.preserve-layout`, `.demo-layout`, and `.slide--outcomes`.
- Mobile layouts can scroll vertically inside the active slide; desktop projection layouts should normally fit without scrolling.
- Specific slide refinements, such as `.slide--discovery` and `.slide--outcomes`, exist to prevent crowding. Do not remove them as redundant CSS.
- Slide 6 deliberately uses more generous headline line-height to prevent the ascender in “Enough” colliding with “open” above it. A compact-height media query keeps it on one screen at 1366×768.
- Slide 11 uses two real photographs. The portrait MiDo installation uses `object-fit: contain` so the gateway and solar panel both remain visible.

There are dedicated rules for narrow screens and for desktop screens with height at or below 800px. Test both dimensions; a desktop-width viewport with a short height can be the difficult case.

Reduced-motion preferences disable or staticise animation. Preserve this behaviour when editing visual effects.

## Slide 9 network graph

`buildNetworkMap()` in `src/main.js` generates the SVG inside `#network-map`.

- The graph is deterministic, not random on each load.
- It currently produces 33 participant nodes and 48 links, plus hub halos and the SVG title.
- Styling and animation are in CSS through `.network-node`, `.network-link`, and `.network-halo`.
- Keep the SVG accessible title and the `network-map-title` relationship.

## MeshCore demonstration

### Files and responsibilities

- `index.html`, slide 15: the interface, prepared public greeting, live transcript, and labelled example transcript.
- `src/main.js`: DOM event handlers, byte counter, connection state, safe message rendering, example toggle.
- `src/meshcore.js`: Bluetooth connection, companion-protocol commands, command queue, parsing, polling, deduplication, and send confirmation.

The live interface IDs are integration contracts. Do not rename them without updating `main.js`:

```text
ble-connect
ble-disconnect
ble-status
public-message-form
public-message
message-count
ble-send
live-transcript
live-empty
example-toggle
example-transcript
```

### Browser and security requirements

- Requires `navigator.bluetooth` and `window.isSecureContext`.
- Use HTTPS or localhost and a supported Chrome/Edge browser.
- Connection must begin from a user gesture.
- The demonstration is for the built-in **Public channel, channel index 0**.
- Direct/contact messages and non-text channel-data packets are not displayed as Public replies.
- The UI must continue to distinguish live messages from the static example.

### BLE service and characteristics

The client uses the Nordic UART-style service exposed by the MeshCore companion firmware:

```text
Service:       6e400001-b5a3-f393-e0a9-e50e24dcca9e
RX/app writes: 6e400002-b5a3-f393-e0a9-e50e24dcca9e
TX/notify:     6e400003-b5a3-f393-e0a9-e50e24dcca9e
```

Connection initialisation:

1. Request a device advertising the service.
2. Connect to GATT and start TX notifications.
3. Send app-start and wait for `SELF_INFO` (`0x05`).
4. Request device information and wait for `DEVICE_INFO` (`0x0d`).
5. Request channel 0 information and wait for `CHANNEL_INFO` (`0x12`).
6. Require the decoded channel 0 name to equal `Public`, case-insensitively.
7. Start listening and polling.

Channel-name parsing stops at the first null terminator. Firmware can leave stale bytes after that terminator; decoding the entire fixed-width field previously produced invalid names. Do not remove that terminator handling.

### Sequential command queue

`MeshCoreClient.enqueue()` serialises commands through one `current` command and a queue.

- Each command has expected response packet types and a timeout.
- A matching response resolves the command and pumps the next one.
- `ERROR` (`0x01`) rejects the active command with a friendly message.
- User sends are priority commands and go to the front of the queue.
- Disconnect rejects outstanding work and clears polling state.
- Background poll failures are intentionally silent so they do not overwrite the status of a user-initiated send.

Be careful when changing queue behaviour. Concurrent writes, overly broad expected-response lists, or unprioritised sends can reintroduce timeouts and false duplicate-send risk.

### Sending Public text

The prepared message is limited to **133 UTF-8 bytes**, not 133 JavaScript characters. `main.js` uses `TextEncoder` for the counter, and `meshcore.js` validates again before sending.

Packet layout:

```text
Byte 0:    0x03
Byte 1:    0x00
Byte 2:    channel index 0
Bytes 3–6: Unix timestamp, uint32 little-endian
Bytes 7+:  UTF-8 message text
```

Send behaviour:

- Wait up to 15 seconds for confirmation.
- Accept `OK` (`0x00`), which actual channel-send firmware returns.
- Also accept `MSG_SENT` (`0x06`) for documented variants.
- Only after radio confirmation, render the outgoing message as confirmed by the radio.
- Request queued messages after sending.
- If confirmation times out, tell the presenter to wait before retrying to avoid a duplicate.

### Receiving and polling

Relevant packet types include:

```text
0x07  CONTACT_MSG
0x08  CHANNEL_MSG
0x0a  NO_MORE
0x10  CONTACT_MSG_V3
0x11  CHANNEL_MSG_V3
0x1b  CHANNEL_DATA
0x83  MESSAGES_WAITING
```

- Standard channel text uses `0x08`; V3 channel text uses `0x11` and has a different offset plus SNR handling.
- Only channel 0 text is rendered in the Public live transcript.
- `0x83` triggers a queued-message request using command `0x0a`.
- Background polling runs every five seconds.
- A received message can trigger a follow-up drain until `NO_MORE` (`0x0a`).
- Reply deduplication uses `timestamp | channel | text`, with a bounded 200-entry set.
- Incoming text is rendered through `textContent`, never HTML interpolation.

### Presentation safeguards

- Only actual public-channel messages may appear in the live transcript.
- The example transcript must retain its `EXAMPLE TRANSCRIPT · NOT LIVE` label.
- The example toggle must continue to work even when WebBluetooth is unavailable.
- Do not repeatedly broadcast merely to force a reply.
- Send only the prepared, non-sensitive public greeting during the presentation.
- Treat every Public-channel message as public.
- Do not let the Bluetooth demo block navigation or hold the presentation hostage.
- Do not overpromise geographic reach or continuous nationwide coverage.

A real radio is required to validate live send/receive behaviour. Browser automation alone cannot prove that part of the integration.

## Three.js brain scene

### Files and activation

- `index.html`, slide 17: `.slide--handovers`, `.brain-scene`, `.brain-fallback`, `#fly-brain-canvas`, and the visible model credit.
- `src/fly-brain.js`: `FlyBrainScene` and all rendering behaviour.
- `assets/vfb-banc-brain.obj`: model geometry.
- `assets/vfb-banc-brain.png`: official static fallback thumbnail.

`main.js` activates the scene only when the active slide has `.slide--handovers`:

```js
flyBrain.setActive(slide.classList.contains("slide--handovers"));
```

Initialisation is lazy. Leaving the slide stops animation. Document visibility and reduced-motion changes are also handled.

### Model and attribution

The actual asset is the **Virtual Fly Brain / BANC** model, not a rat-brain model:

- Model: `BANC:brain_neuropil on JRC2018Unisex`.
- Model page: `VFB_00108w0p`.
- Source: Virtual Fly Brain.
- Licence: CC BY 4.0.
- OBJ statistics: 4,507 vertices, 9,090 faces, 18 components.

Preserve the visible credit and the fuller attribution in `assets/CREDITS.md`. If the presenter notes contain an informal “rat-brain” reference, that does not change the identity or licence of the actual visual asset.

### Rendering behaviour

- Three.js r180 and OBJLoader are vendored locally.
- The model is centred and scaled from its computed bounds.
- Surface, wireframe, and point materials are layered.
- The scene derives real edges from the OBJ geometry.
- Ninety-six selected edges carry deterministic glowing signal heads and trails.
- The activity pattern is deterministic; do not replace it with unconstrained random animation.
- Pointer parallax is subtle and disabled for reduced motion.
- Reduced-motion mode renders a static activity pattern rather than running a continuous animation loop.

On successful initialisation the slide receives `brain-ready`. On WebGL or model-loading failure it receives `brain-fallback-only`, animation stops, and the official image remains visible.

Some headless browsers cannot create a WebGL context. Three.js console errors plus a correctly rendered fallback in that environment are not, by themselves, evidence of a source regression. Also verify in a WebGL-capable browser when changing the scene.

## Ambient canvas

`src/ambient.js` provides a deterministic ripple field for slides with `data-ambient`.

- It uses a seeded pseudo-random sequence.
- Pointer input and timed events create bounded ripples.
- Animation starts only for active ambient slides.
- Reduced-motion mode draws static rings.
- Device pixel ratio is capped at 2.

`main.js` controls activation; do not leave the canvas animation running across every slide.

## Content and accuracy guardrails

These distinctions are part of the reviewed narrative and should not be accidentally flattened:

- LoRa modulation is proprietary technology associated with Semtech; LoRaWAN is an openly published specification developed through the LoRa Alliance.
- Helium Proof-of-Coverage is discussed as a historical example, not described as the current reward mechanism.
- TTN, Helium, Meshtastic, and MeshCore have different motivations and architectures; do not present them as interchangeable.
- RAK makes the Halter hardware. Do not imply from that fact alone that the product uses a particular LoRaWAN radio architecture.
- Slide 11 uses LAIIER's Severn WLD and MiDo's Catanzaro deployment as concrete examples of value beyond packet transmission.
- The sink slide is a thoughtful retirement/change metaphor, not merely a joke at Musk's expense.
- “We did it ourselves” refers to the Chapter 17 `Daodejing` idea; English renderings differ, so do not present one wording as the only definitive translation.
- The brain is a visual metaphor about capability emerging through interaction, not a neuroscience lecture.

## Common editing recipes

### Change slide text or presenter notes

1. Edit the relevant slide in `index.html`.
2. Keep on-slide copy concise; put detail in `template.speaker-notes`.
3. HTML-escape characters where needed inside the template.
4. Open the slide and its notes dialog to verify the actual rendered text.
5. Check the affected slide at 1920×1080, 1366×768, and a phone viewport.

### Adjust typography or spacing

1. Identify the slide-family and slide-specific selectors already present.
2. Prefer a narrowly scoped refinement over changing every slide.
3. Inspect later CSS passes and media queries before adding another override.
4. Verify that desktop content does not collide with the fixed header/footer and does not unexpectedly scroll.
5. On mobile, verify horizontal overflow is absent and vertically scrolled content remains reachable.

### Replace a photograph

1. Add the new file under `assets/` with a descriptive filename.
2. Update the `<img>` source, alt text, and intrinsic width/height.
3. Check cropping with `object-fit` and `object-position`.
4. Add source and licence/credit information to `assets/CREDITS.md`.
5. Keep the photograph relevant to the specific deployment; do not substitute generic IoT imagery.

Current slide 11 photo sources:

- LAIIER Severn WLD: official LAIIER product photography.
- MiDo Catanzaro: official MiDoMet Hydro Control project photography.

### Modify the MeshCore demo

1. Read both `main.js` and `meshcore.js`; the UI and protocol client are deliberately separate.
2. Preserve Public-channel-only behaviour, secure-context checks, and the labelled fallback.
3. Keep response parsing tolerant of the documented `OK` and `MSG_SENT` send-confirmation variants.
4. Test unsupported-browser and insecure-context states without a radio.
5. Test connection, Public-name validation, send confirmation, receiving, deduplication, polling, disconnect, and reconnect with a real companion radio before presenting.

### Modify or replace the brain model

1. Preserve lazy activation, exit cleanup, reduced motion, and the static fallback.
2. Inspect world-space bounds and transforms when replacing geometry; do not guess scale or orientation.
3. Keep signal generation based on actual model edges.
4. Update the visible attribution and `assets/CREDITS.md`.
5. Verify both a real WebGL render and the fallback path.

## Verification checklist

### Static checks

Run JavaScript syntax checks after editing modules:

```bash
node --check src/main.js
node --check src/presenter-notes.js
node --check src/meshcore.js
node --check src/fly-brain.js
node --check src/ambient.js
```

If the directory is a Git repository, also run:

```bash
git diff --check
```

Confirm:

- the expected number of `.slide` sections;
- one `template.speaker-notes` per slide;
- unique element IDs;
- all referenced local assets exist;
- no accidental external runtime dependency was introduced.

### Browser checks

Test at minimum:

- 1920×1080 presentation display;
- 1366×768 smaller projector;
- 390×844 phone viewport.

Check the affected slides and then the complete deck for substantial layout changes:

- no headline/body overlap;
- no horizontal overflow;
- no unintended desktop scrolling;
- mobile scroll reaches the final content;
- images load and crop intentionally;
- speaker notes open, scroll, and close with `N`;
- `notes.html` generates one section for every slide and the notes match their source templates;
- `notes.html` jump anchors and back-to-deck links open the intended locations;
- overview lists every title and jump navigation works;
- hash deep links open the intended slide;
- keyboard and touch navigation still work;
- MeshCore example hide/show state and labels remain correct;
- the brain renders or falls back cleanly;
- there are no unexpected asset 404s or JavaScript exceptions.

For cache-sensitive changes, reload with updated asset query versions rather than mistaking stale CSS or JavaScript for a markup problem.

## Troubleshooting

### The deck works locally but Bluetooth does not

Check that the page is on HTTPS or localhost, the browser supports WebBluetooth, and connection was initiated by a click. An HTTP LAN IP is not sufficient for the live demo.

### The presentation works but the brain is only an image

Check for `brain-fallback-only`. This indicates WebGL or model loading failed and the intended fallback is active. Test in a WebGL-capable browser and inspect the local OBJ/vendor requests.

### Slide content looks different after an edit

Check whether the browser loaded an older CSS or JS query version. Then inspect slide-specific and short-height CSS rules before changing markup.

### Channel 0 is rejected

The demo intentionally requires the built-in Public channel. Confirm the companion's channel 0 configuration. Do not bypass the check by accepting an arbitrary channel name.

### A send reports no confirmation

Wait before retrying to avoid a duplicate. Preserve acceptance of both `0x00` and `0x06`, the 15-second confirmation window, and priority-send queue behaviour.

### No live reply appears

A live reply is never guaranteed. Continue the story and use the clearly labelled example if needed. Do not inject a simulated message into the live transcript.

## Definition of done for future changes

A change is complete when:

- the requested content or behaviour is implemented without a redesign or architecture change;
- existing navigation, notes, overview, demo fallback, and brain fallback still work;
- responsive and reduced-motion behaviour are preserved;
- live/example MeshCore states remain unambiguous;
- asset credits and this guide are updated when relevant;
- the affected slides have been visually verified in a real browser.
