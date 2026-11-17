const notesList = document.querySelector("#notes-list");
const jumpNav = document.querySelector("#notes-jump-nav");
const status = document.querySelector("#notes-status");

function noteParagraphs(template) {
  return (template?.content.textContent.trim() || "")
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function appendNoteParagraphs(container, paragraphs) {
  for (const paragraph of paragraphs) {
    const element = document.createElement("p");
    element.textContent = paragraph;
    container.append(element);
  }
}

function buildNotesDocument(slides) {
  notesList.textContent = "";
  jumpNav.textContent = "";

  slides.forEach((slide, index) => {
    const number = index + 1;
    const id = `slide-${String(number).padStart(2, "0")}`;
    const title = slide.dataset.title || `Slide ${number}`;
    const kicker = slide.dataset.kicker || "";
    const paragraphs = noteParagraphs(slide.querySelector("template.speaker-notes"));

    const jumpLink = document.createElement("a");
    jumpLink.href = `#${id}`;
    jumpLink.textContent = `${String(number).padStart(2, "0")} · ${title}`;
    jumpNav.append(jumpLink);

    const article = document.createElement("article");
    article.className = "notes-slide";
    article.id = id;

    const numberElement = document.createElement("div");
    numberElement.className = "notes-slide-number";
    numberElement.textContent = String(number).padStart(2, "0");

    const content = document.createElement("div");
    content.className = "notes-slide-content";

    const heading = document.createElement("h2");
    const headingLink = document.createElement("a");
    headingLink.href = `#${id}`;
    headingLink.textContent = title;
    heading.append(headingLink);

    const meta = document.createElement("p");
    meta.className = "notes-slide-meta";
    meta.textContent = kicker;

    const copy = document.createElement("div");
    copy.className = "notes-copy";
    appendNoteParagraphs(copy, paragraphs.length ? paragraphs : ["No presenter notes for this slide."]);

    const openSlide = document.createElement("a");
    openSlide.className = "open-slide-link";
    openSlide.href = `./index.html#${number}`;
    openSlide.target = "_blank";
    openSlide.rel = "noopener noreferrer";
    openSlide.textContent = `Open slide ${number} in the deck ↗`;

    content.append(heading, meta, copy, openSlide);
    article.append(numberElement, content);
    notesList.append(article);
  });

  const complete = document.createElement("p");
  complete.className = "notes-status";
  complete.textContent = `${slides.length} slide notes loaded.`;
  jumpNav.append(complete);
}

async function loadPresenterNotes() {
  try {
    const response = await fetch("./index.html", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load the deck (${response.status}).`);
    const source = await response.text();
    const documentSource = new DOMParser().parseFromString(source, "text/html");
    const slides = [...documentSource.querySelectorAll("section.slide")];
    if (!slides.length) throw new Error("No slides were found in index.html.");
    buildNotesDocument(slides);
  } catch (error) {
    status.textContent = error.message || "The presenter notes could not be loaded.";
    status.classList.add("notes-error");
  }
}

loadPresenterNotes();
