const SHEETS_URL = "URL_ANDA_DISINI/exec"; // Ganti dengan URL /exec Anda
async function fetchFromSheets() {
  const res = await fetch(SHEETS_URL, { cache: "no-store" });
  const rows = await res.json(); // rows adalah array dari semua data di Sheet

  // Ambil data TERBARU untuk setiap ruangan (1-6)
  const rooms = [];
  for (let i = 1; i <= 6; i++) {
    const namaRuang = "Ruangan " + i;
    const rowsRuang = rows.filter(r => r.ruangan === namaRuang);
    if (rowsRuang.length > 0) {
      const latest = rowsRuang[rowsRuang.length - 1]; // Ambil baris paling akhir
      rooms.push({ suhu: +latest.suhu, cahaya: +latest.cahaya });
    } else {
      rooms.push({ suhu: 0, cahaya: 0 }); // Jika belum ada data
    }
  }
  return { rooms, fan: 0 }; // 'fan' bisa diambil dari Sheets juga nanti
}
/* ============================================================
   KONFIGURASI
   ============================================================ */
const DEMO_MODE  = true;                       // ← true saat uji tampilan
const ESP_URL    = "http://192.168.1.100";     // ← ganti IP ESP32 Anda
const REFRESH_MS = 3000;

/* ============================================================
   1. ANGGOTA KELOMPOK (5 ORANG)
   ============================================================ */
const ANGGOTA = [
  { nama: "Nama Anggota 1", job: "Hardware & Sensor" },
  { nama: "Nama Anggota 2", job: "Programmer ESP32" },
  { nama: "Nama Anggota 3", job: "Web Developer" },
  { nama: "Nama Anggota 4", job: "Desain UI/UX" },
  { nama: "Nama Anggota 5", job: "Dokumentasi & Laporan" },
];

/* ============================================================
   2. SLIDE CAROUSEL
   ============================================================ */
const SLIDES = [
  {
    title: "Tentang Proyek Kami",
    desc: "Sistem monitoring ruangan incubator ayam berbasis ESP32 untuk memantau " +
          "suhu, intensitas cahaya, dan kecepatan fan exhaust pada 6 ruangan " +
          "secara real-time dan otomatis.",
    bg: "url('assets/foto grup.jpeg')"
  },
  {
    title: "ESP32 — Otak Sistem",
    desc: "Mikrokontroler ESP32 membaca seluruh sensor dan mengirimkan data ke " +
          "web melalui koneksi WiFi secara terus-menerus.",
    bg: "url('assets/ESP.jpg')"
  },
  {
    title: "Sensor DHT22 — Suhu & Kelembapan",
    desc: "Mengukur suhu ruangan dengan akurasi ±0.5°C. Rentang ideal incubator " +
          "ayam adalah 36°C – 39°C.",
    bg: "url('assets/dht 22.jpg')"
  },
  {
    title: "AC Dimmer — Pengontrol Cahaya",
    desc: "Mengatur tingkat kecerahan ruangan incubator dalam persen (0–100%).",
    bg: "url('assets/AC dimmer.webp')"
  },
  {
    title: "Fan Exhaust",
    desc: "Mengatur sirkulasi udara agar suhu dan kelembapan tetap stabil " +
          "sesuai kebutuhan penetasan.",
    bg: "url('assets/fan.jpg')"
  },
];

/* ============================================================
   3. DETEKSI HALAMAN
   ============================================================ */
const page = location.pathname.split("/").pop() || "index.html";

/* ============================================================
   4. UTIL: SIMPAN SNAPSHOT RIWAYAT
   ------------------------------------------------------------
   Setiap data masuk dari ESP, disimpan ke localStorage
   per tanggal & per jam. Riwayat akan baca dari sini.
   ============================================================ */
function saveSnapshot(data) {
  if (!data || !data.rooms) return;
  const now = new Date();
  const key = "hist_" + now.toISOString().slice(0, 10);   // YYYY-MM-DD
  const hour = now.getHours();
  let store = {};
  try { store = JSON.parse(localStorage.getItem(key) || "{}"); } catch { store = {}; }

  data.rooms.forEach((r, i) => {
    if (!store[i]) store[i] = { suhu: Array(24).fill(null), cahaya: Array(24).fill(null) };
    store[i].suhu[hour]   = +(+r.suhu).toFixed(1);
    store[i].cahaya[hour] = Math.round(r.cahaya);
  });
  localStorage.setItem(key, JSON.stringify(store));
}

function getSnapshot(date, roomIdx) {
  const key = "hist_" + date.toISOString().slice(0, 10);
  try {
    const store = JSON.parse(localStorage.getItem(key) || "{}");
    return store[roomIdx] || null;
  } catch { return null; }
}

/* ============================================================
   5. HOME PAGE — CAROUSEL + MONITORING INSTAN
   ============================================================ */
if (page === "index.html" || page === "") {

  /* ---------- Carousel ---------- */
  let current = 0;
  const bgEl    = document.getElementById("slideBg");
  const titleEl = document.getElementById("slideTitle");
  const descEl  = document.getElementById("slideDesc");
  const dotsEl  = document.getElementById("dots");

  if (bgEl && titleEl && descEl && dotsEl) {
    function renderSlide() {
      const s = SLIDES[current];
      bgEl.style.background         = s.bg;
      bgEl.style.backgroundSize     = "cover";
      bgEl.style.backgroundPosition = "center";
      titleEl.textContent = s.title;
      descEl.textContent  = s.desc;
      dotsEl.innerHTML = SLIDES.map((_, i) =>
        `<div class="dot ${i === current ? "active" : ""}" onclick="goSlide(${i})"></div>`
      ).join("");
    }
    window.nextSlide = () => { current = (current + 1) % SLIDES.length; renderSlide(); };
    window.prevSlide = () => { current = (current - 1 + SLIDES.length) % SLIDES.length; renderSlide(); };
    window.goSlide   = (i) => { current = i; renderSlide(); };

    renderSlide();
    setInterval(nextSlide, 7000);
  }

  /* ---------- Monitoring Instan ---------- */
  const imRooms  = document.getElementById("imRooms");
  const imNormal = document.getElementById("imNormal");
  const imWarn   = document.getElementById("imWarn");
  const imFan    = document.getElementById("imFan");
  const imTime   = document.getElementById("imTime");
  const imBadge  = document.getElementById("imBadge");

  function statusColor(t) {
    if (t < 36) return "#3b82f6";
    if (t > 39) return "#ef4444";
    if (t > 37.5) return "#f59e0b";
    return "#22c55e";
  }

  function renderInstant(data) {
    if (!imRooms) return;
    let normal = 0, warn = 0;

    imRooms.innerHTML = data.rooms.map((r, i) => {
      const t        = +r.suhu;
      const isNormal = t >= 36 && t <= 39;
      if (isNormal) normal++; else warn++;
      const color = statusColor(t);
      return `
        <a href="monitoring.html" class="im-room" style="--status:${color}">
          <div class="im-room-head">
            <span class="im-room-name">R${i + 1}</span>
            <span class="im-room-dot"></span>
          </div>
          <div class="im-room-temp">${t.toFixed(1)}°</div>
          <div class="im-room-light">💡 ${Math.round(r.cahaya)}%</div>
        </a>`;
    }).join("");

    if (imNormal) imNormal.textContent = normal;
    if (imWarn)   imWarn.textContent   = warn;
       if (imFan) {
      const isOn = data.fan === 1 || data.fan === "1" || data.fan === true || data.fan === "ON";
      imFan.textContent = isOn ? "ON" : "OFF";
      imFan.style.color = isOn ? "#16a34a" : "#dc2626";
    }
    if (imTime)   imTime.textContent   = new Date().toLocaleTimeString("id-ID");

    if (imBadge) {
      if (warn > 0) {
        imBadge.textContent = `${warn} Peringatan`;
        imBadge.className   = "im-badge danger";
      } else {
        imBadge.textContent = "✓ Semua Normal";
        imBadge.className   = "im-badge";
      }
    }
  }

  function mockInstant() {
    return {
      rooms: Array.from({ length: 6 }, () => {
        const r = Math.random();
        let suhu;
        if (r < 0.15)      suhu = 34 + Math.random() * 1.5;
        else if (r < 0.30) suhu = 39.5 + Math.random() * 2;
        else               suhu = 36.5 + Math.random() * 2;
        return { suhu, cahaya: 30 + Math.random() * 60 };
      }),
      fan: 20 + Math.random() * 70
    };
  }

  async function loadInstant() {
    let data = null;

    if (DEMO_MODE) {
      data = mockInstant();
    } else {
      try {
        const res = await fetch(ESP_URL + "/api/data", { cache: "no-store" });
        if (res.ok) {
          data = await res.json();
          localStorage.setItem("incubatorData", JSON.stringify(data));
          localStorage.setItem("incubatorDataTime", Date.now());
        }
      } catch {
        const cached  = localStorage.getItem("incubatorData");
        const cachedT = parseInt(localStorage.getItem("incubatorDataTime") || "0");
        if (cached && (Date.now() - cachedT < 30000)) {
          data = JSON.parse(cached);
        }
      }
    }

    if (!data) return;
    renderInstant(data);
    saveSnapshot(data);   // ikut isi riwayat
  }

  if (imRooms) {
    loadInstant();
    setInterval(loadInstant, REFRESH_MS);
  }
}

/* ============================================================
   6. MONITORING PAGE
   ============================================================ */
if (page === "monitoring.html") {

  const grid = document.getElementById("roomsGrid");
  grid.innerHTML = Array.from({length: 6}, (_, i) => `
    <div class="room-card">
      <div class="room-head">Ruangan ${i+1}</div>
      <div class="room-body">
        <div class="indicator">
          <svg class="thermo" viewBox="0 0 34 70">
            <rect x="11" y="4" width="12" height="48" rx="6" fill="#e5e7eb"/>
            <rect id="tfill${i}" x="13" y="50" width="8" height="0" rx="4" fill="#3b82f6"/>
            <circle cx="17" cy="58" r="10" fill="#e5e7eb"/>
            <circle id="tbulb${i}" cx="17" cy="58" r="10" fill="#3b82f6"/>
          </svg>
          <div class="ind-val">
            <span class="num" id="tval${i}">--</span>
            <span class="unit">°C</span>
          </div>
        </div>
        <div class="indicator">
          <svg class="lamp" viewBox="0 0 34 54">
            <path id="lampBody${i}"
              d="M17 4 C9 4 3 10 3 18 C3 24 7 28 9 32 L9 36 L25 36 L25 32 C27 28 31 24 31 18 C31 10 25 4 17 4 Z"
              fill="#e5e7eb"/>
            <rect x="11" y="38" width="12" height="4" fill="#9ca3af"/>
            <rect x="11" y="43" width="12" height="4" fill="#9ca3af"/>
            <rect x="11" y="48" width="12" height="4" fill="#9ca3af"/>
          </svg>
          <div class="ind-val">
            <span class="num" id="lval${i}">--</span>
            <span class="unit">%</span>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  function tempColor(t) {
    if (t < 36) return "#3b82f6";
    if (t > 39) return "#ef4444";
    if (t > 37.5) return "#f59e0b";
    return "#22c55e";
  }
  function renderThermo(idx, temp) {
    const pct = Math.max(0, Math.min(100, (temp / 50) * 100));
    const h   = (48 * pct) / 100;
    const y   = 54 - h;
    const color = tempColor(temp);
    const fill = document.getElementById("tfill" + idx);
    const bulb = document.getElementById("tbulb" + idx);
    if (!fill) return;
    fill.setAttribute("height", h);
    fill.setAttribute("y", y);
    fill.setAttribute("fill", color);
    bulb.setAttribute("fill", color);
    document.getElementById("tval" + idx).textContent = temp.toFixed(1);
  }
  function renderLamp(idx, intensity) {
    const opacity = 0.15 + (intensity / 100) * 0.85;
    const body = document.getElementById("lampBody" + idx);
    if (!body) return;
    body.setAttribute("fill", `rgba(249, 115, 22, ${opacity})`);
    body.style.filter = `drop-shadow(0 0 ${intensity / 4}px rgba(249,115,22,0.9))`;
    document.getElementById("lval" + idx).textContent = Math.round(intensity);
  }
    function renderFan(status) {
    const el = document.getElementById("fanStatus");
    const text = document.getElementById("fanText");
    if (!el || !text) return;

    // Cek apakah status bernilai 1, "1", true, atau "ON"
    const isOn = (status === 1 || status === "1" || status === true || status === "ON");

    if (isOn) {
      el.className = "fan-status on";
      text.textContent = "ON";
    } else {
      el.className = "fan-status off";
      text.textContent = "OFF";
    }
  }

  const connBar = document.getElementById("connBar");
  function showConn() { connBar.classList.remove("hidden"); }
  function hideConn() { connBar.classList.add("hidden"); }

    function mockData() {
    return {
      rooms: Array.from({length: 6}, () => ({
        suhu: 34 + Math.random() * 7,
        cahaya: 30 + Math.random() * 60
      })),
      fan: Math.random() > 0.5 ? 1 : 0  // Acak 1 (ON) atau 0 (OFF)
    };
  }

  // Di dalam if (page === "monitoring.html")
async function fetchData() {
  let data;
  if (DEMO_MODE) {
    data = mockData();
  } else {
    try {
      data = await fetchFromSheets(); // <-- Ganti di sini
      hideConn();
    } catch {
      showConn();
      return;
    }
  }
  // ... sisa kode renderThermo, renderLamp, renderFan, saveSnapshot ...

    data.rooms.forEach((r, i) => {
      renderThermo(i, r.suhu);
      renderLamp(i, r.cahaya);
    });
    renderFan(data.fan);

    // Simpan snapshot ke riwayat
    saveSnapshot(data);
    // Simpan untuk dipakai caution
    localStorage.setItem("incubatorData", JSON.stringify(data));
    localStorage.setItem("incubatorDataTime", Date.now());
  }

  fetchData();
  setInterval(fetchData, REFRESH_MS);
}

/* ============================================================
   7. RIWAYAT PAGE
   ------------------------------------------------------------
   Baca dari snapshot localStorage (per tanggal & jam).
   Kalau hari yang dipilih belum ada snapshot → tampil dummy
   (biar halaman tidak kosong), tapi diberi penanda.
   ============================================================ */
if (page === "riwayat.html") {
  const roomSelect = document.getElementById("roomSelect");
  const dateBtns   = document.getElementById("dateButtons");
  const chartTitle = document.getElementById("chartTitle");
  const sumCards   = document.getElementById("summaryCards");
  const tbody      = document.getElementById("dataTableBody");
  let currentDate  = new Date();
  let chart        = null;

  function renderDateButtons() {
    dateBtns.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const btn = document.createElement("button");
      btn.className = "date-btn" + (i === 0 ? " active" : "");
      btn.textContent = label;
      btn.onclick = () => {
        document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentDate = d;
        renderAll();
      };
      dateBtns.appendChild(btn);
    }
  }

  function getHistoryData(room, date) {
    const labels = Array.from({length: 24}, (_, i) => String(i).padStart(2, "0") + ":00");
    const snap   = getSnapshot(date, parseInt(room) - 1);   // room index 0..5

    if (snap) {
      // Pakai snapshot asli — isi null diganti nilai default
      const suhu   = snap.suhu.map(v => v === null ? 0 : v);
      const cahaya = snap.cahaya.map(v => v === null ? 0 : v);
      return { labels, suhu, cahaya, real: true };
    }

    // Fallback dummy untuk demo (data lama belum tersimpan)
    const seed = (parseInt(room) * 137 + date.getDate() * 31) % 1000;
    const suhu   = labels.map((_, h) =>
      +(36.5 + Math.sin((h + seed) * 0.5) * 1.4 + (Math.random() - 0.5) * 0.4).toFixed(1)
    );
    const cahaya = labels.map((_, h) => {
      const c = 45 + Math.sin((h + seed) * 0.3) * 25 + (Math.random() - 0.5) * 6;
      return Math.round(Math.max(0, Math.min(100, c)));
    });
    return { labels, suhu, cahaya, real: false };
  }

  function renderSummary(d) {
    const valid = d.suhu.filter(v => v > 0);
    const avgT = valid.length ? (valid.reduce((a,b)=>a+b,0) / valid.length).toFixed(1) : "--";
    const maxT = valid.length ? Math.max(...valid).toFixed(1) : "--";
    const minT = valid.length ? Math.min(...valid).toFixed(1) : "--";
    const avgC = d.cahaya.filter(v => v > 0);
    const avgCv = avgC.length ? Math.round(avgC.reduce((a,b)=>a+b,0) / avgC.length) : "--";
    sumCards.innerHTML = `
      <div class="sum-card"><div class="lbl">Suhu Rata-rata</div><div class="val">${avgT}°C</div></div>
      <div class="sum-card warm"><div class="lbl">Suhu Tertinggi</div><div class="val">${maxT}°C</div></div>
      <div class="sum-card cool"><div class="lbl">Suhu Terendah</div><div class="val">${minT}°C</div></div>
      <div class="sum-card light"><div class="lbl">Cahaya Rata-rata</div><div class="val">${avgCv}%</div></div>
    `;
  }

  function renderTable(d) {
    tbody.innerHTML = d.labels.map((label, i) => {
      const t = d.suhu[i];
      let badge = '<span class="badge ok">Normal</span>';
      if (!t || t === 0) badge = '<span class="badge">--</span>';
      else if (t < 36)      badge = '<span class="badge warn">Dingin</span>';
      else if (t > 39)      badge = '<span class="badge danger">Panas</span>';
      else if (t > 37.5)    badge = '<span class="badge warn">Hangat</span>';
      return `<tr>
        <td>${label}</td>
        <td>${t ? t.toFixed(1) : "--"}</td>
        <td>${d.cahaya[i] || "--"}</td>
        <td>${badge}</td>
      </tr>`;
    }).join("");
  }

  function renderChart(d) {
    const ctx = document.getElementById("historyChart");
    if (!ctx) return;
    if (chart) { chart.destroy(); chart = null; }
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: d.labels,
        datasets: [
          {
            label: "Suhu (°C)",
            data: d.suhu,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.15)",
            tension: 0.35, fill: true, yAxisID: "y",
            borderWidth: 3, pointRadius: 3
          },
          {
            label: "Cahaya (%)",
            data: d.cahaya,
            borderColor: "#f97316",
            backgroundColor: "rgba(249,115,22,0.15)",
            tension: 0.35, fill: true, yAxisID: "y1",
            borderWidth: 3, pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: {
          y:  { position: "left",  title: { display: true, text: "Suhu (°C)" }, min: 30, max: 45 },
          y1: { position: "right", title: { display: true, text: "Cahaya (%)" }, min: 0, max: 100,
                grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  function renderAll() {
    const room = roomSelect.value;
    const d = getHistoryData(room, currentDate);
    const dateStr = currentDate.toLocaleDateString("id-ID",
      { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    chartTitle.textContent =
      `Riwayat Ruangan ${room} — ${dateStr}` +
      (d.real ? "" : "  (data contoh)");
    renderSummary(d);
    renderChart(d);
    renderTable(d);
  }

  roomSelect.addEventListener("change", renderAll);
  renderDateButtons();
  if (typeof Chart === "undefined") {
    window.addEventListener("load", renderAll);
  } else {
    renderAll();
  }
}

/* ============================================================
   8. CAUTION PAGE
   ------------------------------------------------------------
   Hanya tampil peringatan jika:
     - Ada data (ESP online atau cache < 30 detik)
     - Suhu < 36°C atau > 39°C
   Kalau tidak ada data → tampil "Menunggu koneksi ESP..."
   ============================================================ */
if (page === "caution.html") {
  const grid = document.getElementById("cautionGrid");

  function renderWaiting() {
    grid.innerHTML = `
      <div class="no-warning waiting">
        <div class="ok-icon">⏳</div>
        <p>Menunggu koneksi ESP...</p>
        <p style="font-size:13px; color:#94a3b8; margin-top:8px;">
          Data peringatan akan muncul setelah ESP terhubung.
        </p>
      </div>`;
  }

  function renderNormal() {
    grid.innerHTML = `
      <div class="no-warning">
        <div class="ok-icon">✅</div>
        <p>Semua ruangan dalam kondisi normal</p>
        <p style="font-size:13px; margin-top:8px; color:#94a3b8;">
          Tidak ada peringatan saat ini.
        </p>
      </div>`;
  }

  function renderCaution(rooms) {
    const warnings = rooms
      .map((r, i) => ({ ...r, idx: i + 1 }))
      .filter(r => r.suhu < 36 || r.suhu > 39);

    if (warnings.length === 0) { renderNormal(); return; }

    grid.innerHTML = warnings.map(r => {
      let cls, emoji, title, msg;
      if (r.suhu < 36) {
        cls = "warn"; emoji = "🥶";
        title = `Ruangan ${r.idx} — Suhu Terlalu Dingin`;
        msg = `Suhu saat ini ${r.suhu.toFixed(1)}°C. Segera naikkan pemanas!`;
      } else {
        cls = "danger"; emoji = "🔥";
        title = `Ruangan ${r.idx} — Suhu Terlalu Panas`;
        msg = `Suhu saat ini ${r.suhu.toFixed(1)}°C. Segera aktifkan fan exhaust!`;
      }
      return `
        <div class="warn-card ${cls}">
          <div class="warn-emoji">${emoji}</div>
          <div class="warn-info">
            <strong>${title}</strong>
            <span>${msg}</span>
          </div>
        </div>`;
    }).join("");
  }

  async function loadData() {
    let data = null;
    let fresh = false;   // true kalau data < 30 detik yang lalu

    if (DEMO_MODE) {
      data = {
        rooms: Array.from({length: 6}, () => {
          const rand = Math.random();
          let suhu;
          if (rand < 0.2) suhu = 34 + Math.random() * 1.5;
          else if (rand < 0.4) suhu = 39.5 + Math.random() * 2;
          else suhu = 36.5 + Math.random() * 2;
          return { suhu };
        })
      };
      fresh = true;
    } else {
      try {
        const res = await fetch(ESP_URL + "/api/data", { cache: "no-store" });
        if (res.ok) {
          data = await res.json();
          fresh = true;
          localStorage.setItem("incubatorData", JSON.stringify(data));
          localStorage.setItem("incubatorDataTime", Date.now());
        }
      } catch {
        // coba pakai cache
        const cached  = localStorage.getItem("incubatorData");
        const cachedT = parseInt(localStorage.getItem("incubatorDataTime") || "0");
        if (cached && (Date.now() - cachedT < 30000)) {   // cache < 30 detik
          data = JSON.parse(cached);
          fresh = true;
        }
      }
    }

    // Belum ada data → tampil menunggu
    if (!data || !fresh) { renderWaiting(); return; }

    renderCaution(data.rooms);
  }

  loadData();
  setInterval(loadData, REFRESH_MS);
}