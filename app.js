const STORAGE_KEY = "lap-note-v1";

const lapRules = {
  50: [15, 25, 50],
  100: [25, 50, 75, 100],
  200: [50, 100, 150, 200],
  400: [50, 100, 150, 200, 250, 300, 350, 400],
  800: Array.from({ length: 16 }, (_, i) => (i + 1) * 50),
  1500: Array.from({ length: 30 }, (_, i) => (i + 1) * 50),
};

const logoImage = new Image();
const logoReady = new Promise((resolve) => {
  logoImage.onload = resolve;
  logoImage.onerror = resolve;
});
logoImage.src = "assets/lap-logo-gray.png";

const state = {
  data: loadData(),
  screen: "meets",
  meetId: null,
  swimmerId: null,
  eventId: null,
};

let lastLapAdvanceAt = 0;

const el = {
  title: document.querySelector("#screenTitle"),
  crumb: document.querySelector("#screenCrumb"),
  back: document.querySelector("#backButton"),
  export: document.querySelector("#exportButton"),
  screens: {
    meets: document.querySelector("#meetScreen"),
    swimmers: document.querySelector("#swimmerScreen"),
    events: document.querySelector("#eventScreen"),
    entry: document.querySelector("#entryScreen"),
    preview: document.querySelector("#previewScreen"),
  },
  meetForm: document.querySelector("#meetForm"),
  swimmerForm: document.querySelector("#swimmerForm"),
  eventForm: document.querySelector("#eventForm"),
  meetName: document.querySelector("#meetName"),
  swimmerName: document.querySelector("#swimmerName"),
  eventName: document.querySelector("#eventName"),
  eventDistance: document.querySelector("#eventDistance"),
  meetList: document.querySelector("#meetList"),
  swimmerList: document.querySelector("#swimmerList"),
  eventList: document.querySelector("#eventList"),
  entryForm: document.querySelector("#entryForm"),
  heat: document.querySelector("#heatInput"),
  lane: document.querySelector("#laneInput"),
  rt: document.querySelector("#rtInput"),
  record: document.querySelector("#recordInput"),
  lapTable: document.querySelector("#lapTable"),
  fillRecord: document.querySelector("#fillRecordButton"),
  makeImage: document.querySelector("#makeImageButton"),
  canvas: document.querySelector("#lapCanvas"),
  download: document.querySelector("#downloadButton"),
  backToEntry: document.querySelector("#backToEntryButton"),
};

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { meets: [] };
  } catch {
    return { meets: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function currentMeet() {
  return state.data.meets.find((meet) => meet.id === state.meetId);
}

function currentSwimmer() {
  return currentMeet()?.swimmers.find((swimmer) => swimmer.id === state.swimmerId);
}

function currentEvent() {
  return currentSwimmer()?.events.find((event) => event.id === state.eventId);
}

function showScreen(screen) {
  state.screen = screen;
  Object.entries(el.screens).forEach(([name, node]) => node.classList.toggle("hidden", name !== screen));
  el.back.classList.toggle("hidden", screen === "meets");
  el.export.classList.toggle("hidden", screen !== "entry" && screen !== "preview");

  const meet = currentMeet();
  const swimmer = currentSwimmer();
  const event = currentEvent();
  const titles = {
    meets: ["Lap Note", "大会"],
    swimmers: [meet?.name ?? "大会", "選手"],
    events: [swimmer?.name ?? "選手", "種目"],
    entry: [event?.name ?? "種目", "ラップ入力"],
    preview: ["画像プレビュー", "ラップ帳"],
  };
  [el.crumb.textContent, el.title.textContent] = titles[screen];

  render();
}

function render() {
  renderMeets();
  renderSwimmers();
  renderEvents();
  if (state.screen === "entry") renderEntry();
}

function renderList(container, items, emptyText, renderer) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.querySelector("#emptyTemplate").content.firstElementChild.cloneNode(true);
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  items.forEach((item) => container.append(renderer(item)));
}

function makeListItem({ title, meta, onOpen, onDelete }) {
  const item = document.createElement("div");
  item.className = "list-item";
  const text = document.createElement("button");
  text.className = "plain-list-button";
  text.type = "button";
  text.innerHTML = `<p class="list-title"></p><p class="list-meta"></p>`;
  text.querySelector(".list-title").textContent = title;
  text.querySelector(".list-meta").textContent = meta;
  text.addEventListener("click", onOpen);

  const actions = document.createElement("div");
  actions.className = "item-actions";
  const deleteButton = document.createElement("button");
  deleteButton.className = "tiny-button";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", `${title}を削除`);
  deleteButton.addEventListener("click", onDelete);
  actions.append(deleteButton);

  item.append(text, actions);
  return item;
}

function renderMeets() {
  renderList(el.meetList, state.data.meets, "大会を作成してください", (meet) =>
    makeListItem({
      title: meet.name,
      meta: `${meet.swimmers.length}人`,
      onOpen: () => {
        state.meetId = meet.id;
        showScreen("swimmers");
      },
      onDelete: () => {
        state.data.meets = state.data.meets.filter((item) => item.id !== meet.id);
        saveData();
        render();
      },
    }),
  );
}

function renderSwimmers() {
  const meet = currentMeet();
  renderList(el.swimmerList, meet?.swimmers ?? [], "選手を追加してください", (swimmer) =>
    makeListItem({
      title: swimmer.name,
      meta: `${swimmer.events.length}種目`,
      onOpen: () => {
        state.swimmerId = swimmer.id;
        showScreen("events");
      },
      onDelete: () => {
        meet.swimmers = meet.swimmers.filter((item) => item.id !== swimmer.id);
        saveData();
        render();
      },
    }),
  );
}

function renderEvents() {
  const swimmer = currentSwimmer();
  renderList(el.eventList, swimmer?.events ?? [], "種目を追加してください", (event) =>
    makeListItem({
      title: event.name,
      meta: `${event.distance}m / ${lapRules[event.distance].length}ラップ`,
      onOpen: () => {
        state.eventId = event.id;
        showScreen("entry");
      },
      onDelete: () => {
        swimmer.events = swimmer.events.filter((item) => item.id !== event.id);
        saveData();
        render();
      },
    }),
  );
}

function renderEntry() {
  const event = currentEvent();
  if (!event) return;
  el.heat.value = event.heat ?? "";
  el.lane.value = event.lane ?? "";
  el.rt.value = event.rt ?? "";
  el.record.value = event.record ?? "";
  el.lapTable.innerHTML = "";

  lapRules[event.distance].forEach((distance) => {
    const row = document.createElement("div");
    row.className = "lap-row";
    row.innerHTML = `
      <div class="lap-distance">${distance}m</div>
      <label>
        <span>通過</span>
        <input data-distance="${distance}" enterkeyhint="next" placeholder="例：${distance === event.distance ? "1:00.23" : "30.12"}" />
      </label>
      <div class="lap-split" data-split-for="${distance}">-</div>
    `;
    const input = row.querySelector("input");
    input.value = event.laps?.[distance] ?? "";
    input.addEventListener("input", () => {
      event.laps[distance] = input.value;
      if (distance === event.distance) el.record.value = input.value;
      saveEntryFields();
      updateSplits();
    });
    input.addEventListener("keydown", (keyboardEvent) => {
      advanceLapFromKeyboard(keyboardEvent, distance);
    });
    input.addEventListener("keyup", (keyboardEvent) => {
      advanceLapFromKeyboard(keyboardEvent, distance);
    });
    input.addEventListener("beforeinput", (inputEvent) => {
      if (inputEvent.inputType !== "insertLineBreak" || inputEvent.isComposing) return;
      inputEvent.preventDefault();
      focusNextLapInput(distance);
    });
    el.lapTable.append(row);
  });

  updateSplits();
}

function advanceLapFromKeyboard(event, distance) {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  const now = Date.now();
  if (now - lastLapAdvanceAt < 160) return;
  lastLapAdvanceAt = now;
  focusNextLapInput(distance);
}

function focusNextLapInput(distance) {
  const event = currentEvent();
  if (!event) return;
  const distances = lapRules[event.distance];
  const index = distances.indexOf(distance);
  const nextDistance = distances[index + 1];
  if (nextDistance) {
    el.lapTable.querySelector(`[data-distance="${nextDistance}"]`)?.focus();
  } else {
    el.record.focus();
  }
}

function parseTime(value) {
  const text = String(value).trim().replace("：", ":").replace("・", ":");
  if (!text) return null;
  const parts = text.split(":");
  const seconds = Number(parts.pop().replace(",", "."));
  if (!Number.isFinite(seconds)) return null;
  const minutes = parts.reduce((total, part) => total * 60 + Number(part), 0);
  if (!Number.isFinite(minutes)) return null;
  return minutes * 60 + seconds;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const rounded = Math.round(seconds * 100) / 100;
  const mins = Math.floor(rounded / 60);
  const secs = (rounded - mins * 60).toFixed(2).padStart(mins ? 5 : 0, "0");
  return mins ? `${mins}:${secs}` : secs;
}

function updateSplits() {
  const event = currentEvent();
  if (!event) return;
  let previous = 0;
  lapRules[event.distance].forEach((distance) => {
    const total = parseTime(event.laps?.[distance]);
    const node = el.lapTable.querySelector(`[data-split-for="${distance}"]`);
    node.textContent = total === null ? "-" : formatTime(total - previous);
    if (total !== null) previous = total;
  });
}

function saveEntryFields() {
  const event = currentEvent();
  if (!event) return;
  event.heat = el.heat.value.trim();
  event.lane = el.lane.value.trim();
  event.rt = el.rt.value.trim();
  event.record = el.record.value.trim();
  saveData();
}

async function createCanvasImage() {
  saveEntryFields();
  const meet = currentMeet();
  const swimmer = currentSwimmer();
  const event = currentEvent();
  if (!meet || !swimmer || !event) return;
  await logoReady;

  const ctx = el.canvas.getContext("2d");
  const w = el.canvas.width;
  const h = el.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#bfeee6";
  ctx.fillRect(0, 0, w, h);
  drawWatermark(ctx, w, h);

  const margin = 70;
  const left = margin;
  const right = w - margin;
  const top = 80;
  const bottom = h - 90;
  const line = "#2a7370";
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, right - left, bottom - top);

  const mid = left + (right - left) * 0.54;
  const header1 = top + 160;
  const header2 = top + 305;
  const placeX = right - 130;
  ctx.beginPath();
  [mid, placeX].forEach((x) => {
    ctx.moveTo(x, top);
    ctx.lineTo(x, header2);
  });
  [header1, header2].forEach((y) => {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#143836";
  ctx.font = "700 42px system-ui, sans-serif";
  ctx.fillText("DATE", left + 10, top + 48);
  ctx.fillText("SWIMMER", mid + 10, top + 48);
  ctx.fillText("EVENT", left + 10, header1 + 48);
  ctx.fillText("RECORD", mid + 10, header1 + 48);
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("PLACE", placeX + 10, header1 + 48);

  ctx.font = "500 38px system-ui, sans-serif";
  fitText(ctx, meet.name, left + 12, top + 105, mid - left - 24, 38);
  fitText(ctx, swimmer.name, mid + 12, top + 105, right - mid - 24, 38);
  fitText(ctx, event.name, left + 12, header1 + 112, mid - left - 24, 38);
  fitText(ctx, event.record || event.laps[event.distance] || "", mid + 12, header1 + 112, placeX - mid - 24, 38);
  if (event.rt) {
    ctx.font = "600 25px system-ui, sans-serif";
    ctx.fillText(`RT ${event.rt}`, mid + 12, header1 + 142);
  }
  fitText(ctx, placeText(event), placeX + 10, header1 + 112, right - placeX - 20, 34);

  const lapTop = header2;
  const labelW = 80;
  const tableLeft = left + labelW;
  const rows = buildLapRows(event);
  const totalRows = Math.max(10, Math.ceil(rows.length / 2));
  const rowH = (bottom - lapTop) / totalRows;
  const leftDistanceX = tableLeft + 105;
  const leftTimeX = tableLeft + 245;
  const rightDistanceX = mid + 105;
  const rightTimeX = mid + 245;

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + labelW, lapTop);
  ctx.lineTo(left + labelW, bottom);
  ctx.moveTo(mid, lapTop);
  ctx.lineTo(mid, bottom);
  ctx.moveTo(leftDistanceX, lapTop);
  ctx.lineTo(leftDistanceX, bottom);
  ctx.moveTo(leftTimeX, lapTop);
  ctx.lineTo(leftTimeX, bottom);
  ctx.moveTo(rightDistanceX, lapTop);
  ctx.lineTo(rightDistanceX, bottom);
  ctx.moveTo(rightTimeX, lapTop);
  ctx.lineTo(rightTimeX, bottom);
  for (let i = 1; i < totalRows; i += 1) {
    const y = lapTop + rowH * i;
    ctx.moveTo(tableLeft, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();

  ctx.save();
  ctx.translate(left + 38, lapTop + (bottom - lapTop) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LAP TIME", 0, 0);
  ctx.restore();

  ctx.textAlign = "right";
  rows.forEach((row, index) => {
    const side = index < totalRows ? "left" : "right";
    const rowIndex = index % totalRows;
    const y = lapTop + rowH * rowIndex + rowH * 0.66;
    const splitX = side === "left" ? mid - 24 : right - 24;
    const valueX = side === "left" ? leftTimeX - 20 : rightTimeX - 20;
    const distX = side === "left" ? leftDistanceX - 18 : rightDistanceX - 18;
    const distSize = totalRows > 12 ? 28 : 36;
    const timeSize = totalRows > 12 ? 27 : 34;
    const splitSize = totalRows > 12 ? 20 : 25;
    ctx.font = `700 ${distSize}px system-ui, sans-serif`;
    ctx.fillText(`${row.distance}M`, distX, y);
    ctx.font = `500 ${timeSize}px system-ui, sans-serif`;
    ctx.fillText(row.total || "", valueX, y);
    ctx.font = `700 ${splitSize}px system-ui, sans-serif`;
    ctx.fillText(row.split ? `(${row.split})` : "", splitX, y);
  });
}

function buildLapRows(event) {
  let previous = 0;
  return lapRules[event.distance].map((distance) => {
    const totalText = event.laps[distance] ?? "";
    const total = parseTime(totalText);
    const split = total === null ? "" : formatTime(total - previous);
    if (total !== null) previous = total;
    return { distance, total: totalText, split };
  });
}

function drawWatermark(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  if (logoImage.complete && logoImage.naturalWidth) {
    const maxW = w * 0.55;
    const maxH = h * 0.43;
    const scale = Math.min(maxW / logoImage.naturalWidth, maxH / logoImage.naturalHeight);
    const drawW = logoImage.naturalWidth * scale;
    const drawH = logoImage.naturalHeight * scale;
    const x = (w - drawW) / 2;
    const y = h * 0.36;
    ctx.drawImage(logoImage, x, y, drawW, drawH);
  } else {
    ctx.fillStyle = "#226967";
    ctx.font = "900 116px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LAP", w / 2, h / 2 + 118);
  }
  ctx.restore();
}

function fitText(ctx, text, x, y, maxWidth, size) {
  ctx.save();
  ctx.textAlign = "left";
  let fontSize = size;
  do {
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > maxWidth && fontSize > 18);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function placeText(event) {
  if (event.heat && event.lane) return `${event.heat}/${event.lane}`;
  if (event.heat) return `${event.heat}/`;
  if (event.lane) return `/${event.lane}`;
  return "";
}

el.meetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.data.meets.unshift({ id: uid(), name: el.meetName.value.trim(), swimmers: [] });
  el.meetName.value = "";
  saveData();
  render();
});

el.swimmerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentMeet().swimmers.unshift({ id: uid(), name: el.swimmerName.value.trim(), events: [] });
  el.swimmerName.value = "";
  saveData();
  render();
});

el.eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const distance = Number(el.eventDistance.value);
  currentSwimmer().events.unshift({
    id: uid(),
    name: el.eventName.value.trim(),
    distance,
    heat: "",
    lane: "",
    rt: "",
    record: "",
    laps: {},
  });
  el.eventName.value = "";
  saveData();
  render();
});

[el.heat, el.lane, el.rt, el.record].forEach((input) => input.addEventListener("input", saveEntryFields));

el.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const activeDistance = document.activeElement?.dataset?.distance;
  if (activeDistance) {
    focusNextLapInput(Number(activeDistance));
    return;
  }
  saveEntryFields();
});

el.fillRecord.addEventListener("click", () => {
  const event = currentEvent();
  if (!event) return;
  event.laps[event.distance] = el.record.value.trim();
  saveData();
  renderEntry();
});

el.makeImage.addEventListener("click", async () => {
  await createCanvasImage();
  showScreen("preview");
});

el.export.addEventListener("click", async () => {
  if (state.screen === "entry") {
    await createCanvasImage();
    showScreen("preview");
  } else if (state.screen === "preview") {
    await downloadCanvas();
  }
});

el.download.addEventListener("click", downloadCanvas);

el.backToEntry.addEventListener("click", () => showScreen("entry"));

async function downloadCanvas() {
  await createCanvasImage();
  const link = document.createElement("a");
  const meet = currentMeet()?.name ?? "meet";
  const swimmer = currentSwimmer()?.name ?? "swimmer";
  const event = currentEvent()?.name ?? "event";
  link.download = `${meet}_${swimmer}_${event}_lap.png`.replace(/[\\/:*?"<>|]/g, "_");
  link.href = el.canvas.toDataURL("image/png");
  link.click();
}

el.back.addEventListener("click", () => {
  if (state.screen === "preview") return showScreen("entry");
  if (state.screen === "entry") return showScreen("events");
  if (state.screen === "events") return showScreen("swimmers");
  if (state.screen === "swimmers") return showScreen("meets");
});

showScreen("meets");
