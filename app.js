"use strict";

/* ------------------------------------------------------------------ *
 * Layout constants measured from bg.jpeg / example.jpeg.
 * Base coordinate space = bg.jpeg (828 x 807). Everything is scaled
 * by S when drawn on the hi-res canvas (same scale as example.jpeg).
 * ------------------------------------------------------------------ */
const BASE_W = 828, BASE_H = 807;
const OUT_W = 1268;                       // output width (matches example.jpeg scale)
const S = OUT_W / BASE_W;                 // ~1.5314
const OUT_H = Math.round(BASE_H * S);     // ~1236

const LAYOUT = {
  // white card area that gets replaced by the blue background + frames
  erase: { x: 20, y: 202, w: 788, h: 590 },
  eraseGrad: ["rgb(208,245,250)", "rgb(196,238,248)"],

  frame1: { x: 29, y: 210, w: 768, h: 305 },   // speaker / main view
  frame2: { x: 28, y: 522, w: 772, h: 268 },   // gallery view

  frameColor: "#0b1115",
  shadow: { color: "rgba(52,130,190,0.38)", blur: 28, offsetY: 5 },

  title: { cx: 710, capTop: 13, size: 27, maxW: 232 },
  date:  { cx: 710, capTop: 35.5, size: 26, maxW: 232 },
  textColor: "rgb(7,25,100)",
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
};

/* ---------------- state ---------------- */
const state = { title: "", date: "", img1: null, img2: null };

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = OUT_W;
canvas.height = OUT_H;

let bgImg = null;

/* ---------------- background template ---------------- */
function loadBackground() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { bgImg = img; resolve(); };
    img.onerror = () => resolve();
    img.src = window.BG_DATA_URI;
  });
}

/* ---------------- drawing helpers ---------------- */
function px(v) { return v * S; }

function drawFittedText(text, cfg) {
  if (!text.trim()) return;
  let size = cfg.size;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${size}px ${LAYOUT.fontFamily}`;
  const maxW = px(cfg.maxW);
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.max(9, Math.floor(size * (maxW / w)));
    ctx.font = `bold ${size}px ${LAYOUT.fontFamily}`;
    w = ctx.measureText(text).width;
  }
  ctx.fillStyle = LAYOUT.textColor;
  const capHeight = size * 0.716;             // Arial cap height / em
  const baseline = px(cfg.capTop) + capHeight;
  ctx.fillText(text, px(cfg.cx), baseline);
}

function drawContain(img, frame) {
  if (!img) return;
  const fw = px(frame.w), fh = px(frame.h);
  const scale = Math.min(fw / img.width, fh / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  const dx = px(frame.x) + (fw - dw) / 2;
  const dy = px(frame.y) + (fh - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ---------------- main render ---------------- */
function render() {
  if (!bgImg) return;

  ctx.clearRect(0, 0, OUT_W, OUT_H);
  ctx.drawImage(bgImg, 0, 0, OUT_W, OUT_H);

  // 1. replace the blank white card with the page's blue backdrop
  const e = LAYOUT.erase;
  const g = ctx.createLinearGradient(px(e.x), 0, px(e.x + e.w), 0);
  g.addColorStop(0, LAYOUT.eraseGrad[0]);
  g.addColorStop(1, LAYOUT.eraseGrad[1]);
  ctx.fillStyle = g;
  ctx.fillRect(px(e.x), px(e.y), px(e.w), px(e.h));

  // 2. dark frames with soft blue glow (as in the reference)
  ctx.save();
  ctx.shadowColor = LAYOUT.shadow.color;
  ctx.shadowBlur = px(LAYOUT.shadow.blur);
  ctx.shadowOffsetY = px(LAYOUT.shadow.offsetY);
  ctx.fillStyle = LAYOUT.frameColor;
  for (const f of [LAYOUT.frame1, LAYOUT.frame2]) {
    ctx.fillRect(px(f.x), px(f.y), px(f.w), px(f.h));
  }
  ctx.restore();

  // 3. screenshots (contain-fit, centered, never cropped)
  drawContain(state.img1, LAYOUT.frame1);
  drawContain(state.img2, LAYOUT.frame2);

  // 4. title + date in the top-right white box
  drawFittedText(state.title, LAYOUT.title);
  drawFittedText(state.date, LAYOUT.date);

  updateUIState();
}

function updateUIState() {
  const hasContent = bgImg && (state.title || state.date || state.img1 || state.img2);
  document.getElementById("canvasPlaceholder").classList.toggle("hidden", !!hasContent);
  document.getElementById("downloadBtn").disabled = !(state.img1 && state.img2);
}

/* ---------------- inputs ---------------- */
const titleInput = document.getElementById("titleInput");
const dateInput = document.getElementById("dateInput");
titleInput.addEventListener("input", () => { state.title = titleInput.value; render(); });
dateInput.addEventListener("input", () => { state.date = dateInput.value; render(); });

function wireUpload(idx) {
  const drop = document.getElementById("drop" + idx);
  const input = document.getElementById("file" + idx);
  const thumb = document.getElementById("thumb" + idx);
  const rm = document.getElementById("rm" + idx);
  const key = "img" + idx;

  const setFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      state[key] = img;
      thumb.src = img.src;
      drop.classList.add("has-image");
      rm.hidden = false;
      render();
    };
    img.src = URL.createObjectURL(file);
  };

  drop.addEventListener("click", (e) => { if (e.target !== rm) input.click(); });
  input.addEventListener("change", () => setFile(input.files[0]));
  rm.addEventListener("click", (e) => {
    e.stopPropagation();
    state[key] = null;
    input.value = "";
    thumb.src = "";
    drop.classList.remove("has-image");
    rm.hidden = true;
    render();
  });

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragover"); })
  );
  drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));
}
wireUpload(1);
wireUpload(2);

/* ---------------- download ---------------- */
document.getElementById("downloadBtn").addEventListener("click", () => {
  const name = (state.title || state.date || "dokumentasi-zoom")
    .trim().toLowerCase().replace(/[^\w\d-]+/g, "-").replace(/^-+|-+$/g, "") || "dokumentasi-zoom";
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
});

/* ---------------- boot ---------------- */
loadBackground().then(render);
