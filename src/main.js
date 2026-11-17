import { RippleField } from "./ambient.js";
import { MeshCoreClient, friendlyError } from "./meshcore.js";
import { FlyBrainScene } from "./fly-brain.js";

const slides = [...document.querySelectorAll(".slide")];
const progressBar = document.querySelector("#progress-bar");
const slideCount = document.querySelector("#slide-count");
const slideTitle = document.querySelector("#slide-title");
const slideKicker = document.querySelector("#slide-kicker");
const overviewDialog = document.querySelector("#overview-dialog");
const notesDialog = document.querySelector("#notes-dialog");
const overviewList = document.querySelector("#overview-list");
const rippleField = new RippleField(document.querySelector("#ambient"));
const flyBrain = new FlyBrainScene(document.querySelector("#fly-brain-canvas"));
let current = -1;
let toastTimer;

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

function buildOverview() {
  slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("strong");
    title.textContent = slide.dataset.title;
    button.append(number, title);
    button.addEventListener("click", () => {
      overviewDialog.close();
      goTo(index);
    });
    overviewList.append(button);
  });
}

function nextSlide() {
  goTo(current + 1);
}

function previousSlide() {
  goTo(current - 1);
}

function goTo(index, updateHash = true) {
  const next = Math.max(0, Math.min(slides.length - 1, index));
  if (next === current) return;
  current = next;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === current;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
    slide.inert = !active;
    if (active) slide.scrollTop = 0;
  });
  const slide = slides[current];
  document.body.dataset.theme = slide.dataset.theme;
  rippleField.setActive(slide.hasAttribute("data-ambient"));
  flyBrain.setActive(slide.classList.contains("slide--handovers"));
  progressBar.style.width = `${((current + 1) / slides.length) * 100}%`;
  slideCount.innerHTML = `${String(current + 1).padStart(2, "0")} <i>/</i> ${slides.length}`;
  slideTitle.textContent = slide.dataset.title;
  slideKicker.textContent = slide.dataset.kicker;
  document.title = `${String(current + 1).padStart(2, "0")} · ${slide.dataset.title} — The Tao of LoRaWAN`;
  [...overviewList.children].forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === current);
    if (buttonIndex === current) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (updateHash) history.replaceState(null, "", `#${current + 1}`);
}

function openNotes() {
  if (notesDialog.open) return notesDialog.close();
  if (overviewDialog.open) overviewDialog.close();
  const slide = slides[current];
  document.querySelector("#notes-title").textContent = slide.dataset.title;
  document.querySelector("#notes-content").textContent = slide.querySelector(".speaker-notes")?.content.textContent.trim() || "No notes for this slide.";
  notesDialog.showModal();
}

function openOverview() {
  if (overviewDialog.open) return overviewDialog.close();
  if (notesDialog.open) notesDialog.close();
  overviewDialog.showModal();
  overviewList.children[current]?.scrollIntoView({ block: "nearest" });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen is not available in this browser window.");
  }
}

const actions = {
  first: () => goTo(0),
  previous: previousSlide,
  next: nextSlide,
  notes: openNotes,
  overview: openOverview,
  fullscreen: toggleFullscreen,
};
document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", actions[button.dataset.action]));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));
document.addEventListener("fullscreenchange", () => {
  const button = document.querySelector('[data-action="fullscreen"]');
  button.innerHTML = document.fullscreenElement ? 'Exit fullscreen <kbd>F</kbd>' : 'Fullscreen <kbd>F</kbd>';
});

document.addEventListener("keydown", event => {
  const typing = ["INPUT", "TEXTAREA"].includes(event.target.tagName) || event.target.isContentEditable;
  if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === "n") { event.preventDefault(); openNotes(); return; }
  if (key === "o") { event.preventDefault(); openOverview(); return; }
  if (overviewDialog.open || notesDialog.open) return;
  if (["arrowright", "arrowdown", " ", "pagedown"].includes(key)) { event.preventDefault(); nextSlide(); }
  if (["arrowleft", "arrowup", "pageup"].includes(key)) { event.preventDefault(); previousSlide(); }
  if (key === "home") { event.preventDefault(); goTo(0); }
  if (key === "end") { event.preventDefault(); goTo(slides.length - 1); }
  if (key === "f") { event.preventDefault(); toggleFullscreen(); }
});

window.addEventListener("hashchange", () => {
  const index = Number.parseInt(location.hash.slice(1), 10) - 1;
  if (Number.isFinite(index)) goTo(index, false);
});

let touchStart = null;
document.addEventListener("touchstart", event => {
  if (event.target.closest("button, textarea, a, dialog, .live-transcript")) return;
  touchStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
}, { passive: true });
document.addEventListener("touchend", event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    if (dx < 0) nextSlide();
    else previousSlide();
  }
}, { passive: true });

function buildNetworkMap() {
  const svg = document.querySelector("#network-map");
  const ns = "http://www.w3.org/2000/svg";
  const center = 350;
  const hubs = Array.from({ length: 3 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 3;
    return { x: center + Math.cos(angle) * 112, y: center + Math.sin(angle) * 112, hub: true };
  });
  const nodes = [...hubs];
  [205, 285].forEach((radius, ring) => {
    const count = ring === 0 ? 12 : 18;
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count + ring * .13;
      const wobble = 1 + Math.sin(index * 2.17 + ring) * .09;
      nodes.push({ x: center + Math.cos(angle) * radius * wobble, y: center + Math.sin(angle) * radius * wobble, hub: false });
    }
  });
  const addLine = (a, b, hot = false) => {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", a.x.toFixed(2)); line.setAttribute("y1", a.y.toFixed(2));
    line.setAttribute("x2", b.x.toFixed(2)); line.setAttribute("y2", b.y.toFixed(2));
    line.setAttribute("class", `network-link${hot ? " hot" : ""}`);
    svg.append(line);
  };
  hubs.forEach((hub, index) => addLine(hub, hubs[(index + 1) % hubs.length], true));
  nodes.slice(3).forEach((node, index) => {
    const hub = hubs[index % hubs.length];
    addLine(node, hub, index % 5 === 0);
    const neighbour = nodes[3 + ((index + 1) % (nodes.length - 3))];
    if (index % 2 === 0) addLine(node, neighbour);
  });
  nodes.forEach((node, index) => {
    if (node.hub) {
      const halo = document.createElementNS(ns, "circle");
      halo.setAttribute("cx", node.x); halo.setAttribute("cy", node.y); halo.setAttribute("r", 17);
      halo.setAttribute("class", "network-halo");
      halo.style.animationDelay = `${index * .8}s`;
      svg.append(halo);
    }
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", node.x); circle.setAttribute("cy", node.y);
    circle.setAttribute("r", node.hub ? 8 : (index % 4 === 0 ? 4 : 2.5));
    circle.setAttribute("class", `network-node${node.hub ? " hub" : ""}`);
    svg.append(circle);
  });
}

/* MeshCore demo */
const connectButton = document.querySelector("#ble-connect");
const disconnectButton = document.querySelector("#ble-disconnect");
const sendButton = document.querySelector("#ble-send");
const status = document.querySelector("#ble-status");
const messageInput = document.querySelector("#public-message");
const transcript = document.querySelector("#live-transcript");
let liveEmpty = document.querySelector("#live-empty");
const conversation = document.querySelector(".demo-conversation");
const messageCount = document.querySelector("#message-count");
const exampleToggle = document.querySelector("#example-toggle");
const exampleTranscript = document.querySelector("#example-transcript");

function updateMessageCount() {
  const length = new TextEncoder().encode(messageInput.value).length;
  messageCount.textContent = `${length} / 133 bytes`;
  messageCount.style.color = length > 133 ? "#fce1b6" : "";
}
updateMessageCount();
messageInput.addEventListener("input", updateMessageCount);

function addLiveMessage(message) {
  liveEmpty?.remove();
  liveEmpty = null;
  const article = document.createElement("article");
  article.className = `live-message ${message.direction === "outgoing" ? "outgoing" : "incoming"}`;
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const label = document.createElement("span");
  label.textContent = message.direction === "outgoing" ? "Sent to Public · confirmed by radio" : "Live · Public channel";
  const time = document.createElement("time");
  const date = new Date(message.timestamp * 1000);
  time.dateTime = date.toISOString();
  time.textContent = `${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${Number.isFinite(message.snr) && message.snr !== null ? ` · ${message.snr} dB` : ""}`;
  meta.append(label, time);
  const text = document.createElement("p");
  text.textContent = message.text;
  article.append(meta, text);
  transcript.append(article);
  transcript.scrollTop = transcript.scrollHeight;
}

const mesh = new MeshCoreClient({
  onState(connected, name) {
    conversation.classList.toggle("is-connected", connected);
    sendButton.disabled = !connected;
    disconnectButton.hidden = !connected;
    connectButton.disabled = false;
    connectButton.innerHTML = connected ? `Connected · ${name || "MeshCore"}` : 'Connect companion <span>↗</span>';
    if (!connected && !status.textContent.includes("disconnected")) status.textContent = "Not connected. The labelled example remains available.";
  },
  onStatus(message) { status.textContent = message; },
  onMessage: addLiveMessage,
});

if (!MeshCoreClient.supported()) {
  status.textContent = window.isSecureContext ? "WebBluetooth is not available in this browser. Use a supported Chrome or Edge browser." : "Bluetooth needs HTTPS or localhost. The example transcript is still available.";
}

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  try { await mesh.connect(); }
  catch (error) { status.textContent = friendlyError(error); }
  finally { connectButton.disabled = false; }
});
disconnectButton.addEventListener("click", async () => {
  await mesh.disconnect();
  status.textContent = "Disconnected. No live connection remains.";
});
document.querySelector("#public-message-form").addEventListener("submit", async event => {
  event.preventDefault();
  sendButton.disabled = true;
  try { await mesh.sendPublic(messageInput.value); }
  catch (error) { status.textContent = friendlyError(error); }
  finally { sendButton.disabled = !mesh.connected; }
});
exampleToggle.addEventListener("click", () => {
  const expanded = exampleToggle.getAttribute("aria-expanded") === "true";
  exampleToggle.setAttribute("aria-expanded", String(!expanded));
  exampleToggle.textContent = expanded ? "Show example" : "Hide example";
  exampleTranscript.hidden = expanded;
});

buildOverview();
buildNetworkMap();
const initial = Number.parseInt(location.hash.slice(1), 10) - 1;
goTo(Number.isFinite(initial) ? initial : 0, false);
