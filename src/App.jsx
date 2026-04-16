import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB DATABASE LAYER
// ═══════════════════════════════════════════════════════════════════════════════

class GitHubDB {
  constructor(token, repo, owner) {
    this.token = token.replace(/[^\x20-\x7E]/g, "").trim();
    this.repo = repo.trim();
    this.owner = owner.trim();
    this.base = `https://api.github.com/repos/${this.owner}/${this.repo}/contents`;
    this.cache = {};
    this.shas = {};
  }
  headers() {
    return { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" };
  }
  async read(path) {
    try {
      const res = await fetch(`${this.base}/${path}`, { headers: this.headers() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GitHub read error: ${res.status}`);
      const data = await res.json();
      this.shas[path] = data.sha;
      return JSON.parse(atob(data.content.replace(/\n/g, "")));
    } catch (e) { console.error("GitHubDB read:", e); throw e; }
  }
  async write(path, data, message) {
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const body = { message: message || `Update ${path}`, content };
      if (this.shas[path]) body.sha = this.shas[path];
      const res = await fetch(`${this.base}/${path}`, { method: "PUT", headers: this.headers(), body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(`GitHub write error: ${res.status} — ${err.message}`); }
      const result = await res.json();
      this.shas[path] = result.content.sha;
      return data;
    } catch (e) { console.error("GitHubDB write:", e); throw e; }
  }
  async init() {
    const files = { "data/registrations.json": [], "data/products.json": [], "data/state-offices.json": DEFAULT_STATES, "data/settings.json": { alertDays: 10, emailEnabled: true } };
    for (const [path, def] of Object.entries(files)) { if ((await this.read(path)) === null) await this.write(path, def, `Initialize ${path}`); }
  }
  async uploadFile(path, base64Content, message) {
    try {
      const body = { message: message || `Upload ${path}`, content: base64Content };
      if (this.shas[path]) body.sha = this.shas[path];
      const res = await fetch(`${this.base}/${path}`, { method: "PUT", headers: this.headers(), body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(`Upload error: ${res.status} — ${err.message}`); }
      const result = await res.json();
      this.shas[path] = result.content.sha;
      return result.content.path;
    } catch (e) { console.error("GitHubDB uploadFile:", e); throw e; }
  }
  // Fetch file and return as Blob for download/print
  async downloadFile(path) {
    try {
      const res = await fetch(`${this.base}/${path}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`Download error: ${res.status}`);
      const data = await res.json();
      this.shas[path] = data.sha;
      // Decode base64 content
      const byteChars = atob(data.content.replace(/\n/g, ""));
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const ext = path.split(".").pop().toLowerCase();
      const mimeMap = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      return new Blob([byteArray], { type: mimeMap[ext] || "application/octet-stream" });
    } catch (e) { console.error("GitHubDB downloadFile:", e); throw e; }
  }
  async testConnection() {
    const res = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}`, { headers: this.headers() });
    if (!res.ok) throw new Error(res.status === 404 ? "Repository not found — check the owner/repo and token access" : res.status === 401 ? "Invalid token" : res.status === 403 ? "Permission denied — needs Contents Read & Write" : `Error: ${res.status}`);
    return await res.json();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL 50 STATES — blank templates for user to fill in
// ═══════════════════════════════════════════════════════════════════════════════

const BLANK = { contact: "", email: "", phone: "", processingTime: "", fees: "", requirements: [], notes: "", registrationFormUrl: "", registrationFormFile: "", deadlines: [], submissionMethod: "mail", onlinePortalUrl: "", checkPayee: "", mailingAddress: "" };
const DEFAULT_STATES = {
  AL: { name: "Alabama", ...BLANK }, AK: { name: "Alaska", ...BLANK }, AZ: { name: "Arizona", ...BLANK },
  AR: { name: "Arkansas", ...BLANK }, CA: { name: "California", ...BLANK }, CO: { name: "Colorado", ...BLANK },
  CT: { name: "Connecticut", ...BLANK }, DE: { name: "Delaware", ...BLANK }, FL: { name: "Florida", ...BLANK },
  GA: { name: "Georgia", ...BLANK }, HI: { name: "Hawaii", ...BLANK }, ID: { name: "Idaho", ...BLANK },
  IL: { name: "Illinois", ...BLANK }, IN: { name: "Indiana", ...BLANK }, IA: { name: "Iowa", ...BLANK },
  KS: { name: "Kansas", ...BLANK }, KY: { name: "Kentucky", ...BLANK }, LA: { name: "Louisiana", ...BLANK },
  ME: { name: "Maine", ...BLANK }, MD: { name: "Maryland", ...BLANK }, MA: { name: "Massachusetts", ...BLANK },
  MI: { name: "Michigan", ...BLANK }, MN: { name: "Minnesota", ...BLANK }, MS: { name: "Mississippi", ...BLANK },
  MO: { name: "Missouri", ...BLANK }, MT: { name: "Montana", ...BLANK }, NE: { name: "Nebraska", ...BLANK },
  NV: { name: "Nevada", ...BLANK }, NH: { name: "New Hampshire", ...BLANK }, NJ: { name: "New Jersey", ...BLANK },
  NM: { name: "New Mexico", ...BLANK }, NY: { name: "New York", ...BLANK }, NC: { name: "North Carolina", ...BLANK },
  ND: { name: "North Dakota", ...BLANK }, OH: { name: "Ohio", ...BLANK }, OK: { name: "Oklahoma", ...BLANK },
  OR: { name: "Oregon", ...BLANK }, PA: { name: "Pennsylvania", ...BLANK }, RI: { name: "Rhode Island", ...BLANK },
  SC: { name: "South Carolina", ...BLANK }, SD: { name: "South Dakota", ...BLANK }, TN: { name: "Tennessee", ...BLANK },
  TX: { name: "Texas", ...BLANK }, UT: { name: "Utah", ...BLANK }, VT: { name: "Vermont", ...BLANK },
  VA: { name: "Virginia", ...BLANK }, WA: { name: "Washington", ...BLANK }, WV: { name: "West Virginia", ...BLANK },
  WI: { name: "Wisconsin", ...BLANK }, WY: { name: "Wyoming", ...BLANK }, DC: { name: "District of Columbia", ...BLANK },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS & STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#F5F6F8", surface: "#FFFFFF", surfaceAlt: "#FAFBFC", border: "#E1E4EA", borderLight: "#ECEEF2",
  text: "#171A1F", textSec: "#5B616E", textTri: "#8C93A0",
  primary: "#2563EB", primaryHover: "#1D4ED8", primaryLight: "#EFF6FF", primaryFaint: "#F5F8FF",
  teal: "#0D9488", tealLight: "#F0FDFA",
  red: "#DC2626", redLight: "#FEF2F2", redBorder: "#FECACA",
  orange: "#EA580C", orangeLight: "#FFF7ED", orangeBorder: "#FED7AA",
  green: "#16A34A", greenLight: "#F0FDF4", greenBorder: "#BBF7D0",
  purple: "#7C3AED", purpleLight: "#F5F3FF", purpleBorder: "#DDD6FE",
  grey: "#6B7280", greyLight: "#F9FAFB", greyBorder: "#E5E7EB",
};
const S = {
  card: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 },
  badge: (bg, fg, bd) => ({ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color: fg, border: `1px solid ${bd}`, whiteSpace: "nowrap" }),
  btn: (v = "primary") => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: v === "sm" ? "6px 12px" : "10px 20px", borderRadius: 10, border: v === "outline" ? `1px solid ${C.border}` : "none", background: v === "primary" ? C.primary : v === "danger" ? C.red : "transparent", color: v === "primary" || v === "danger" ? "#fff" : C.text, fontSize: v === "sm" ? 12 : 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }),
  input: { padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surface, color: C.text, width: "100%", boxSizing: "border-box" },
  select: { padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surface, color: C.text, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235B616E' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36 },
};
const statusCfg = { Pending: { bg: C.orangeLight, fg: C.orange, bd: C.orangeBorder }, "In Review": { bg: C.purpleLight, fg: C.purple, bd: C.purpleBorder }, Approved: { bg: C.greenLight, fg: C.green, bd: C.greenBorder }, Expired: { bg: C.greyLight, fg: C.grey, bd: C.greyBorder }, Rejected: { bg: C.redLight, fg: C.red, bd: C.redBorder } };
const priorityCfg = { Critical: { bg: C.redLight, fg: C.red, bd: C.redBorder }, High: { bg: C.orangeLight, fg: C.orange, bd: C.orangeBorder }, Medium: { bg: C.purpleLight, fg: C.purple, bd: C.purpleBorder }, Low: { bg: C.greenLight, fg: C.green, bd: C.greenBorder } };

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const I = ({ n, s = 18, c = C.textSec, st = {} }) => {
  const d = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    library: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    printer: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    cat: <><path d="M12 5c-1.5-2.5-4-3-5-2s-1 3.5 0 5c-2 1-3 3-3 5 0 3.5 3.5 6 8 6s8-2.5 8-6c0-2-1-4-3-5 1-1.5 1-4 0-5s-3.5-.5-5 2z"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M10 16.5c.5.5 1.5 1 2 1s1.5-.5 2-1"/></>,
    github: <><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={st}>{d[n]}</svg>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Badge({ children, cfg }) { return <span style={S.badge(cfg.bg, cfg.fg, cfg.bd)}>{children}</span>; }
function Progress({ cur, tot, size = "md" }) {
  const pct = tot > 0 ? (cur / tot) * 100 : 0;
  const clr = pct === 100 ? C.green : pct >= 50 ? C.primary : C.orange;
  const h = size === "sm" ? 4 : 6;
  return (<div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: h, borderRadius: h, background: C.borderLight, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: h, background: clr, transition: "width 0.4s ease" }} /></div><span style={{ fontSize: 12, fontWeight: 600, color: clr, minWidth: 36, textAlign: "right" }}>{cur}/{tot}</span></div>);
}
function StatCard({ label, value, sub, icon, accent }) {
  return (<div style={{ ...S.card, padding: 20, display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 170 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n={icon} s={22} c={accent} /></div><div><div style={{ fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</div><div style={{ fontSize: 13, color: C.textSec, marginTop: 2 }}>{label}</div>{sub && <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 2 }}>{sub}</div>}</div></div>);
}
function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (<div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}><div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} /><div style={{ ...S.card, width, maxWidth: "92vw", maxHeight: "85vh", overflow: "auto", position: "relative", zIndex: 1, padding: 0 }} onClick={e => e.stopPropagation()}><div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.surface, zIndex: 2, borderRadius: "14px 14px 0 0" }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><I n="x" s={20} c={C.textSec} /></button></div><div style={{ padding: 24 }}>{children}</div></div></div>);
}
function Toast({ message, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const bg = type === "success" ? C.green : type === "error" ? C.red : C.primary;
  return (<div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2000, background: bg, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, animation: "slideUp 0.3s ease" }}><I n={type === "success" ? "check" : "alert"} s={16} c="#fff" />{message}</div>);
}
function Spinner({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>;
}
function Field({ label, children, note }) {
  return (<div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</label>{children}{note && <div style={{ fontSize: 11, color: C.textTri, marginTop: 3 }}>{note}</div>}</div>);
}
function FileUploadBtn({ label, fileName, onUpload, uploading, filePath, db }) {
  const inputRef = useRef(null);
  const [working, setWorking] = useState(false);
  const handleClick = () => inputRef.current?.click();
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };
  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!db || !filePath) return;
    setWorking(true);
    try {
      const blob = await db.downloadFile(filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || filePath.split("/").pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert("Download failed: " + err.message); }
    setWorking(false);
  };
  const handlePrint = async (e) => {
    e.stopPropagation();
    if (!db || !filePath) return;
    setWorking(true);
    try {
      const blob = await db.downloadFile(filePath);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => { try { win.print(); } catch(_) {} });
      }
    } catch (err) { alert("Print failed: " + err.message); }
    setWorking(false);
  };
  return (<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: `1px solid ${fileName ? C.greenBorder : C.border}`, background: fileName ? C.greenLight : C.surface, marginBottom: 8 }}>
    <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${fileName ? C.green : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: fileName ? C.green : "transparent", flexShrink: 0 }}>{fileName && <I n="check" s={14} c="#fff" />}</div>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>{fileName && <div style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>}</div>
    <input ref={inputRef} type="file" onChange={handleChange} style={{ display: "none" }} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
    {fileName && filePath && db && (<>
      <button onClick={handleDownload} disabled={working} title="Download" style={{ ...S.btn("outline"), padding: "5px 10px", fontSize: 11 }}><I n="download" s={13} c={C.textSec} /></button>
      <button onClick={handlePrint} disabled={working} title="Print" style={{ ...S.btn("outline"), padding: "5px 10px", fontSize: 11 }}><I n="printer" s={13} c={C.textSec} /></button>
    </>)}
    <button onClick={handleClick} disabled={uploading} style={{ ...S.btn("outline"), padding: "5px 12px", fontSize: 12, opacity: uploading ? 0.5 : 1 }}>
      {uploading ? <><Spinner size={14} /> Uploading...</> : <><I n={fileName ? "edit" : "upload"} s={14} c={C.textSec} /> {fileName ? "Replace" : "Upload"}</>}
    </button>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function SetupPage({ onConnect }) {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("licensewatcher-data");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const sanitize = (v) => v.replace(/[^\x20-\x7E]/g, "").trim();
  const handleTest = async () => {
    setTesting(true); setError("");
    try {
      const ct = sanitize(token), co = sanitize(owner), cr = sanitize(repo);
      if (!ct.startsWith("github_pat_") && !ct.startsWith("ghp_")) throw new Error("Token should start with github_pat_ or ghp_. Check for hidden chars from copy-paste.");
      const db = new GitHubDB(ct, cr, co);
      await db.testConnection(); setStep(2);
      await db.init(); setStep(3);
      setTimeout(() => onConnect({ token: ct, owner: co, repo: cr }), 800);
    } catch (e) { setError(e.message); }
    setTesting(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.bg} 0%, ${C.primaryFaint} 50%, ${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <div style={{ width: 520, animation: "fadeIn 0.5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: C.primary, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 32px rgba(37,99,235,0.3)" }}><I n="cat" s={32} c="#fff" /></div>
          <h1 style={{ margin: "0 0 6px", fontSize: 32, fontWeight: 800, color: C.text }}>LicenseWatcher</h1>
          <p style={{ margin: 0, color: C.textSec, fontSize: 16 }}>Connect your GitHub repository to get started</p>
        </div>
        <div style={{ ...S.card, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}><I n="github" s={22} c="#fff" /></div>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>GitHub Database Setup</div><div style={{ fontSize: 13, color: C.textSec }}>Data stored as JSON files in a private repo</div></div>
          </div>
          {step >= 2 && <div style={{ padding: "12px 16px", borderRadius: 10, background: C.greenLight, border: `1px solid ${C.greenBorder}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.3s ease" }}><I n="check" s={16} c={C.green} /><span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Connected to {owner}/{repo}</span></div>}
          {step >= 3 && <div style={{ padding: "12px 16px", borderRadius: 10, background: C.greenLight, border: `1px solid ${C.greenBorder}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.3s ease" }}><I n="check" s={16} c={C.green} /><span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Data files initialized — launching app...</span></div>}
          {step === 1 && (<>
            <Field label="GitHub Personal Access Token *" note="Fine-grained token scoped to your data repo. Create at github.com/settings/tokens?type=beta"><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx" style={S.input} /></Field>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label="GitHub Username / Org *"><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="your-username" style={S.input} /></Field>
              <Field label="Repository Name *"><input value={repo} onChange={e => setRepo(e.target.value)} placeholder="licensewatcher-data" style={S.input} /></Field>
            </div>
            {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: C.redLight, border: `1px solid ${C.redBorder}`, marginBottom: 16, fontSize: 13, color: C.red, fontWeight: 500 }}>{error}</div>}
            <button onClick={handleTest} disabled={!token || !owner || !repo || testing} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", opacity: (!token || !owner || !repo || testing) ? 0.5 : 1, marginTop: 4 }}>{testing ? <><Spinner size={16} /> Connecting...</> : <><I n="zap" s={16} c="#fff" /> Connect & Initialize</>}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardPage({ registrations, onNavigate, onAction }) {
  const stats = useMemo(() => {
    const t = registrations.length, ex = registrations.filter(r => r.daysLeft > 0 && r.daysLeft <= 30).length;
    const ov = registrations.filter(r => r.daysLeft < 0).length, ap = registrations.filter(r => r.status === "Approved").length;
    const rate = t > 0 ? Math.round((ap / t) * 100) : 0;
    return { total: t, expiring: ex, overdue: ov, rate };
  }, [registrations]);

  // All deadline instances not yet approved, sorted by urgency
  const allDeadlines = useMemo(() => {
    const items = [];
    registrations.forEach(r => {
      (r.upcomingDeadlines || []).forEach(d => {
        if (!d.approved && r.status !== "Approved" && r.status !== "Rejected") {
          items.push({ ...d, reg: r });
        }
      });
    });
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return items;
  }, [registrations]);

  const alerts = useMemo(() => allDeadlines.filter(d => d.daysLeft <= 30).slice(0, 8), [allDeadlines]);
  const upcomingTop = useMemo(() => allDeadlines.filter(d => d.daysLeft > 30).slice(0, 10), [allDeadlines]);

  if (registrations.length === 0) return (
    <div><h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800 }}>Dashboard</h1><p style={{ margin: "0 0 32px", color: C.textSec }}>Monitor your state feed registrations</p>
      <div style={{ ...S.card, textAlign: "center", padding: 60 }}><div style={{ width: 64, height: 64, borderRadius: 16, background: C.primaryLight, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><I n="cat" s={32} c={C.primary} /></div><h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>No Registrations Yet</h2><p style={{ margin: "0 0 20px", color: C.textSec }}>Start by populating your State Library, then register your first product.</p><button onClick={() => onNavigate("library")} style={S.btn("primary")}><I n="library" s={16} c="#fff" /> Go to State Library</button></div></div>
  );
  return (
    <div>
      <div style={{ marginBottom: 28 }}><h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Dashboard</h1><p style={{ margin: "4px 0 0", color: C.textSec, fontSize: 15 }}>Monitor your state feed registrations and compliance status</p></div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Total Registrations" value={stats.total} icon="list" accent={C.primary} />
        <StatCard label="Expiring Soon" value={stats.expiring} sub="Next 30 days" icon="clock" accent={C.orange} />
        <StatCard label="Overdue" value={stats.overdue} sub="Requires attention" icon="alert" accent={C.red} />
        <StatCard label="Active Deadlines" value={allDeadlines.length} sub="Next 12 months" icon="calendar" accent={C.teal} />
        <StatCard label="Approval Rate" value={`${stats.rate}%`} icon="trending" accent={C.green} />
      </div>

      {/* Priority Alerts — always visible */}
      <div style={{ ...S.card, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><I n="alert" s={18} c={C.red} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Urgent &amp; Overdue</h3></div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textSec }}>Overdue or due within 30 days</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.length === 0 && <p style={{ color: C.textTri, fontSize: 14, textAlign: "center", padding: 16 }}>No urgent deadlines — all caught up!</p>}
          {alerts.map((d) => (
            <div key={`${d.reg.id}_${d.instanceKey}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: d.daysLeft < 0 ? C.redLight : d.daysLeft < 10 ? C.orangeLight : C.bg, border: `1px solid ${d.daysLeft < 0 ? C.redBorder : d.daysLeft < 10 ? C.orangeBorder : C.borderLight}` }}>
              <I n="cat" s={18} c={d.daysLeft < 0 ? C.red : d.daysLeft < 10 ? C.orange : C.textSec} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.reg.productName} — {d.title}</div>
                <div style={{ fontSize: 12, color: C.textSec }}>{d.reg.stateName} · {d.nextDate}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.daysLeft < 0 ? C.red : d.daysLeft < 10 ? C.orange : C.teal, background: d.daysLeft < 0 ? C.redLight : d.daysLeft < 10 ? C.orangeLight : C.tealLight, padding: "4px 10px", borderRadius: 10 }}>{d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}</span>
              <button onClick={() => onAction(d.reg, { title: d.title, nextDate: d.nextDate, year: d.year, instanceKey: d.instanceKey })} style={{ ...S.btn("outline"), padding: "6px 14px", fontSize: 12 }}>Action</button>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><I n="calendar" s={18} c={C.orange} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upcoming Deadlines</h3></div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSec }}>Next filings, renewals, and tonnage reports</p>
          </div>
          <button onClick={() => onNavigate("deadlines")} style={{ ...S.btn("outline"), fontSize: 13, padding: "8px 16px" }}>View All</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcomingTop.length === 0 && <p style={{ color: C.textTri, fontSize: 14, textAlign: "center", padding: 16 }}>No deadlines in the next 12 months.</p>}
          {upcomingTop.map(d => (
            <div key={`${d.reg.id}_${d.instanceKey}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
              <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textTri, textTransform: "uppercase" }}>{new Date(d.nextDate).toLocaleDateString("en-US", { month: "short" })}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1 }}>{new Date(d.nextDate).getDate()}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title} <span style={{ color: C.textTri, fontSize: 11, fontWeight: 500 }}>· {d.year}</span></div>
                <div style={{ fontSize: 12, color: C.textSec }}>{d.reg.productName} · {d.reg.stateName}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: d.daysLeft < 10 ? C.red : d.daysLeft < 30 ? C.orange : C.teal, background: d.daysLeft < 10 ? C.redLight : d.daysLeft < 30 ? C.orangeLight : C.tealLight, padding: "3px 9px", borderRadius: 10 }}>{d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}</span>
              <button onClick={() => onAction(d.reg, { title: d.title, nextDate: d.nextDate, year: d.year, instanceKey: d.instanceKey })} style={{ ...S.btn("outline"), padding: "5px 12px", fontSize: 12 }}>Action</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATIONS TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function DeadlinesPage({ registrations, stateReqs, onAction, onEditProduct }) {
  const [search, setSearch] = useState("");
  const [fState, setFState] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Flatten all deadline instances across all registrations
  const instances = useMemo(() => {
    const items = [];
    registrations.forEach(r => {
      (r.upcomingDeadlines || []).forEach(d => {
        items.push({
          ...d,
          reg: r,
          productName: r.productName,
          productType: r.productType,
          state: r.state,
          stateName: r.stateName,
          status: r.status,
          id: `${r.id}_${d.instanceKey}`,
        });
      });
    });
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return items;
  }, [registrations]);

  const filtered = useMemo(() => {
    let list = instances;
    // Archive filter: archived = approved deadline instances
    if (showArchived) {
      list = list.filter(d => d.approved);
    } else {
      list = list.filter(d => !d.approved);
    }
    if (search) list = list.filter(d => d.productName.toLowerCase().includes(search.toLowerCase()) || d.stateName.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase()));
    if (fState) list = list.filter(d => d.state === fState);
    if (fProduct) list = list.filter(d => d.productName === fProduct);
    return list;
  }, [instances, showArchived, search, fState, fProduct]);

  const states = useMemo(() => [...new Set(registrations.map(r => r.state))].sort(), [registrations]);
  const productNames = useMemo(() => [...new Set(registrations.map(r => r.productName))].sort(), [registrations]);

  // Group by month
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(d => {
      const date = new Date(d.nextDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!g[key]) g[key] = { label, items: [] };
      g[key].items.push(d);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div><h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Deadlines</h1><p style={{ margin: "4px 0 0", color: C.textSec, fontSize: 15 }}>All upcoming filings for the next 12 months, rolling forward</p></div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setShowArchived(false)} style={{ ...S.btn(showArchived ? "outline" : "primary"), padding: "8px 14px", fontSize: 13 }}>Active</button>
        <button onClick={() => setShowArchived(true)} style={{ ...S.btn(showArchived ? "primary" : "outline"), padding: "8px 14px", fontSize: 13 }}>Archived</button>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 260, marginLeft: 8 }}>
          <I n="search" s={16} c={C.textTri} st={{ position: "absolute", left: 12, top: 12 }} />
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, paddingLeft: 36 }} />
        </div>
        <select value={fState} onChange={e => setFState(e.target.value)} style={{ ...S.select, width: 150 }}>
          <option value="">All states</option>{states.map(s => <option key={s} value={s}>{stateReqs[s]?.name || s}</option>)}
        </select>
        <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{ ...S.select, width: 180 }}>
          <option value="">All products</option>{productNames.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 13, color: C.textSec }}>{filtered.length} deadline{filtered.length === 1 ? "" : "s"}</div>
      </div>

      {grouped.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.textTri }}>
          {registrations.length === 0
            ? "No products registered yet. Go to Registrations to add your first product."
            : showArchived
              ? "No archived deadlines yet."
              : "No deadlines found. Make sure your states have deadlines configured in the State Library."}
        </div>
      )}

      {grouped.map(([key, { label, items }]) => (
        <div key={key} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.textTri, marginBottom: 10 }}>{label} <span style={{ color: C.textSec, fontWeight: 500 }}>— {items.length}</span></div>
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            {items.map((d, i) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.borderLight}` : "none", opacity: d.approved ? 0.6 : 1 }}>
                <div style={{ width: 52, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textTri, textTransform: "uppercase" }}>{new Date(d.nextDate).toLocaleDateString("en-US", { month: "short" })}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1 }}>{new Date(d.nextDate).getDate()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{d.title} <span style={{ color: C.textTri, fontSize: 12, fontWeight: 500 }}>· {d.year}</span></div>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    <span onClick={() => onEditProduct?.(d.productName)} style={{ cursor: "pointer", color: C.text, fontWeight: 500 }} onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"} onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{d.productName}</span>
                    <span style={{ color: C.textTri }}> · </span>{d.stateName}
                  </div>
                </div>
                {d.approved ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenLight, padding: "4px 10px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}><I n="check" s={12} c={C.green} /> Approved</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: d.daysLeft < 10 ? C.red : d.daysLeft < 30 ? C.orange : C.teal, background: d.daysLeft < 10 ? C.redLight : d.daysLeft < 30 ? C.orangeLight : C.tealLight, padding: "4px 10px", borderRadius: 10 }}>{d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}</span>
                )}
                <button onClick={() => onAction(d.reg, { title: d.title, nextDate: d.nextDate, year: d.year, instanceKey: d.instanceKey })} style={{ ...S.btn("outline"), padding: "6px 14px", fontSize: 12 }}>Action</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATIONS (PRODUCTS) PAGE — product-centric view, bulk editing
// ═══════════════════════════════════════════════════════════════════════════════

function ProductsPage({ registrations, stateReqs, products, onEditProduct, onBulkUpdate, onUpdateRegStatus, saving, onNewReg }) {
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null); // "delete" | "type" | "rename"
  const [bulkValue, setBulkValue] = useState("");

  // Group registrations by product name
  const byProduct = useMemo(() => {
    const m = {};
    registrations.forEach(r => {
      if (!m[r.productName]) m[r.productName] = [];
      m[r.productName].push(r);
    });
    return m;
  }, [registrations]);

  const productNames = Object.keys(byProduct).sort();

  const toggleExpand = (name) => setExpanded(p => ({ ...p, [name]: !p[name] }));
  const toggleSelect = (name) => setSelected(p => { const n = new Set(p); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const selectAll = () => setSelected(selected.size === productNames.length ? new Set() : new Set(productNames));

  const runBulkAction = async () => {
    if (bulkAction === "delete") {
      if (!confirm(`Delete ${selected.size} product(s) and all their registrations?`)) return;
      onBulkUpdate({ action: "delete", productNames: [...selected] });
    } else if (bulkAction === "type") {
      if (!bulkValue) return;
      onBulkUpdate({ action: "changeType", productNames: [...selected], newType: bulkValue });
    }
    setSelected(new Set());
    setBulkAction(null);
    setBulkValue("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Registrations</h1>
          <p style={{ margin: "4px 0 0", color: C.textSec, fontSize: 15 }}>Products and where they are registered — manage legal details and files</p>
        </div>
        <button onClick={onNewReg} style={S.btn("primary")}><I n="plus" s={16} c="#fff" /> Register New Product</button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div style={{ ...S.card, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, background: C.primaryFaint, border: `1px solid ${C.primary}40` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{selected.size} selected</span>
          <button onClick={() => setBulkAction("type")} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12 }}>Change Type</button>
          <button onClick={() => setBulkAction("delete")} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12, color: C.red, borderColor: C.redBorder }}>Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12, marginLeft: "auto" }}>Clear</button>
        </div>
      )}

      {bulkAction === "type" && (
        <div style={{ ...S.card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Change type for {selected.size} product(s) to:</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{ ...S.select, width: 200 }}>
              <option value="">Select type...</option>
              <option>Pet Treat</option>
              <option>Cat Supplement</option>
              <option>Dog Food</option>
              <option>Cat Food</option>
              <option>Specialty Pet Food</option>
            </select>
            <button onClick={runBulkAction} disabled={!bulkValue} style={{ ...S.btn("primary"), padding: "8px 14px", fontSize: 13 }}>Apply</button>
            <button onClick={() => { setBulkAction(null); setBulkValue(""); }} style={{ ...S.btn("outline"), padding: "8px 14px", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {bulkAction === "delete" && (
        <div style={{ ...S.card, padding: 14, marginBottom: 14, background: C.redLight, border: `1px solid ${C.redBorder}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.red }}>Delete {selected.size} product(s) and all their state registrations?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={runBulkAction} style={{ ...S.btn("danger"), padding: "8px 14px", fontSize: 13 }}>Confirm Delete</button>
            <button onClick={() => setBulkAction(null)} style={{ ...S.btn("outline"), padding: "8px 14px", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {productNames.length === 0 && (<div style={{ ...S.card, textAlign: "center", padding: 40, color: C.textTri }}>No products registered yet.</div>)}

      {productNames.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.size === productNames.length} onChange={selectAll} /> Select all
          </label>
        </div>
      )}

      {productNames.map(pName => {
        const regs = byProduct[pName];
        const product = products.find(p => p.name === pName);
        const isOpen = expanded[pName];
        const isSelected = selected.has(pName);
        const approvedCt = regs.filter(r => r.status === "Approved").length;

        return (
          <div key={pName} style={{ ...S.card, padding: 0, marginBottom: 10, overflow: "hidden", border: `1px solid ${isSelected ? C.primary : C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: isSelected ? C.primaryFaint : C.surface }}>
              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(pName)} />
              <div style={{ width: 32, height: 32, borderRadius: 8, background: product?.type === "Cat Supplement" ? C.tealLight : C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <I n="cat" s={18} c={product?.type === "Cat Supplement" ? C.teal : C.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{pName}</div>
                <div style={{ fontSize: 12, color: C.textSec }}>
                  {product?.type || "—"} · {regs.length} state registration{regs.length === 1 ? "" : "s"} · {approvedCt} approved
                  {product?.legalCategory && <> · <span style={{ color: C.primary, fontWeight: 600 }}>{product.legalCategory}</span></>}
                </div>
              </div>
              <button onClick={() => onEditProduct(pName)} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12 }}><I n="edit" s={13} c={C.textSec} /> Edit Product</button>
              <button onClick={() => toggleExpand(pName)} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12 }}><I n={isOpen ? "chevronDown" : "chevronRight"} s={13} c={C.textSec} /> {isOpen ? "Collapse" : `${regs.length} states`}</button>
            </div>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.borderLight}`, background: C.bg }}>
                {regs.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < regs.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, width: 30 }}>{r.state}</span>
                    <span style={{ flex: 1, fontSize: 13, color: C.textSec }}>{r.stateName}</span>
                    <Badge cfg={statusCfg[r.status]}>{r.status}</Badge>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => onUpdateRegStatus(r.id, "Approved")} title="Approve permanently" style={{ background: "none", border: `1px solid ${C.greenBorder}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.green, fontSize: 11, fontWeight: 600 }}>✓ Approve</button>
                      <button onClick={() => onUpdateRegStatus(r.id, "Expired")} title="Pause" style={{ background: "none", border: `1px solid ${C.greyBorder}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.grey, fontSize: 11, fontWeight: 600 }}>⏸ Pause</button>
                      <button onClick={() => onUpdateRegStatus(r.id, "Rejected")} title="Reject" style={{ background: "none", border: `1px solid ${C.redBorder}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.red, fontSize: 11, fontWeight: 600 }}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE LIBRARY PAGE — fully editable
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: try to parse date text like "2026-01-01" or "January 1" into {month, day}
function parseDateText(text) {
  if (!text) return null;
  // Try YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return { month: parseInt(isoMatch[2]), day: parseInt(isoMatch[3]) };
  // Try MM/DD or MM-DD
  const slashMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})/);
  if (slashMatch) return { month: parseInt(slashMatch[1]), day: parseInt(slashMatch[2]) };
  return null;
}

function LibraryPage({ stateReqs, onSaveState, onBulkSave, saving, db }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [newReq, setNewReq] = useState("");
  const [uploadingForm, setUploadingForm] = useState(false);

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const handleFormFileUpload = async (file) => {
    if (!db || !editing) return;
    setUploadingForm(true);
    try {
      const b64 = await fileToBase64(file);
      const ext = file.name.split(".").pop();
      const path = `uploads/state-forms/${editing}/registration_form.${ext}`;
      await db.uploadFile(path, b64, `Upload ${editing} registration form`);
      setForm(prev => ({ ...prev, registrationFormFile: path }));
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingForm(false);
  };

  const entries = Object.entries(stateReqs).filter(([c, s]) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || c.toLowerCase().includes(search.toLowerCase()));
  const hasAnyData = (s) => s.contact || s.email || s.fees || s.processingTime || (s.requirements?.length > 0) || (s.deadlines?.length > 0) || s.notes;
  const filled = entries.filter(([, s]) => hasAnyData(s));
  const empty = entries.filter(([, s]) => !hasAnyData(s));

  const startEdit = (code) => {
    setEditing(code);
    setForm({ ...stateReqs[code] });
    setNewReq("");
  };
  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const addReq = () => { if (newReq.trim()) { setForm(prev => ({ ...prev, requirements: [...(prev.requirements || []), newReq.trim()] })); setNewReq(""); } };
  const removeReq = (idx) => setForm(prev => ({ ...prev, requirements: prev.requirements.filter((_, i) => i !== idx) }));
  const handleSave = () => { onSaveState(editing, form); setEditing(null); };

  // Download template — serves the pre-built XLSX from /state_offices_template.xlsx in public/
  const downloadTemplate = () => {
    window.open("/state_offices_template.xlsx", "_blank");
  };

  // XLSX Upload using SheetJS — matches template: A=Code B=Name C=Contact D=Email E=Phone F=Fees G=Processing
  // H/I/J=DL1 title/month/day, K/L/M=DL2, N/O/P=DL3, Q/R/S=DL4, T/U/V=DL5, W=Docs X=FormURL Y=Notes
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("state")) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rows.length < 2) return;

      // Find header row
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (String(rows[i]?.[0] || "").toLowerCase().includes("state")) { headerIdx = i; break; }
      }

      const updated = { ...stateReqs };
      let loadedCount = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const code = String(r[0]).trim().toUpperCase();
        if (!updated[code]) continue;

        const str = (idx) => r[idx] != null ? String(r[idx]).trim() : "";
        const num = (idx) => { const v = parseInt(r[idx]); return isNaN(v) ? 0 : v; };

        // Read up to 5 deadlines from column pairs (H/I/J, K/L/M, N/O/P, Q/R/S, T/U/V)
        const deadlines = [];
        for (let d = 0; d < 5; d++) {
          const baseCol = 7 + d * 3; // H=7, K=10, N=13, Q=16, T=19
          const title = str(baseCol);
          const month = num(baseCol + 1);
          const day = num(baseCol + 2);
          if (title && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            deadlines.push({ title, month, day });
          }
        }

        updated[code] = {
          ...updated[code],
          contact: str(2) || updated[code].contact || "",
          email: str(3) || updated[code].email || "",
          phone: str(4) || updated[code].phone || "",
          fees: str(5) || updated[code].fees || "",
          processingTime: str(6) || updated[code].processingTime || "",
          deadlines: deadlines.length > 0 ? deadlines : updated[code].deadlines || [],
          requirements: str(22) ? str(22).split(";").map(s => s.trim()).filter(Boolean) : updated[code].requirements || [],
          registrationFormUrl: str(23) || updated[code].registrationFormUrl || "",
          notes: str(24) || updated[code].notes || "",
        };
        loadedCount++;
      }
      onBulkSave(updated);
      alert(`Loaded data for ${loadedCount} states.`);
    } catch (err) { console.error("XLSX parse error:", err); alert("Error parsing file: " + err.message); }
    e.target.value = "";
  };

  const StateCard = ({ code, st }) => {
    const hasForms = st.registrationFormUrl;
    const hasData = st.contact || st.email || st.fees || st.processingTime || (st.requirements?.length > 0) || (st.deadlines?.length > 0);
    return (
      <div style={{ ...S.card, cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", position: "relative" }} onClick={() => startEdit(code)} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
        <div style={{ position: "absolute", top: 12, right: 12 }}><I n="edit" s={15} c={C.textTri} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasData ? 14 : 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, background: C.primaryLight, padding: "4px 10px", borderRadius: 6 }}>{code}</span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{st.name}</span>
        </div>
        {!hasData && <div style={{ fontSize: 13, color: C.textTri, fontStyle: "italic", padding: "8px 0" }}>Not configured yet — click to add info</div>}
        {hasData && (<>
          <div style={{ fontSize: 11, color: C.textTri, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>Contact</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{st.contact}</div>
          {st.email && <div style={{ fontSize: 13, color: C.primary, marginBottom: 2 }}>{st.email}</div>}
          {st.phone && <div style={{ fontSize: 13, color: C.textSec, marginBottom: 10 }}>{st.phone}</div>}
          <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
            {st.processingTime && <div><div style={{ fontSize: 11, color: C.textTri, fontWeight: 600 }}>Processing</div><div style={{ fontSize: 13, fontWeight: 600 }}>{st.processingTime}</div></div>}
            {st.fees && <div><div style={{ fontSize: 11, color: C.textTri, fontWeight: 600 }}>Fees</div><div style={{ fontSize: 13, fontWeight: 600 }}>{st.fees}</div></div>}
          </div>
          {st.deadlines?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {st.deadlines.filter(d => d.title).map((d, i) => {
              const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              return <div key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", gap: 4 }}><I n="calendar" s={11} c={C.orange} /><span style={{ fontWeight: 600, color: C.orange }}>{d.title}</span><span style={{ color: C.textSec }}>{months[d.month - 1]} {d.day}</span></div>;
            })}
          </div>}
          {st.requirements?.length > 0 && (<><div style={{ fontSize: 11, color: C.textTri, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>Required Documents</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{st.requirements.map(req => <span key={req} style={{ ...S.badge(C.tealLight, C.teal, C.teal + "30"), fontSize: 11, padding: "3px 8px" }}>{req}</span>)}</div></>)}
          {hasForms && <a href={st.registrationFormUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ marginTop: 8, fontSize: 12, color: C.primary, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}><I n="download" s={12} c={C.primary} /> Download registration form</a>}
          {st.notes && <div style={{ marginTop: 10, fontSize: 12, color: C.textSec, fontStyle: "italic", padding: "8px 10px", background: C.bg, borderRadius: 8 }}>{st.notes}</div>}
        </>)}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div><h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>State Offices Library</h1><p style={{ margin: "4px 0 0", color: C.textSec, fontSize: 15 }}>Contact info, requirements, deadlines, and forms for each state — click any card to edit</p></div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={downloadTemplate} style={S.btn("outline")}><I n="download" s={16} c={C.textSec} /> Download Template</button>
          <label style={{ ...S.btn("primary"), cursor: "pointer" }}><I n="upload" s={16} c="#fff" /> Upload XLSX<input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: "none" }} /></label>
        </div>
      </div>
      <div style={{ position: "relative", maxWidth: 400, marginBottom: 24 }}><I n="search" s={16} c={C.textTri} st={{ position: "absolute", left: 12, top: 12 }} /><input placeholder="Search states..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, paddingLeft: 36 }} /></div>

      {filled.length > 0 && (<><div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.textTri, marginBottom: 12 }}>Configured ({filled.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16, marginBottom: 28 }}>{filled.map(([code, st]) => <StateCard key={code} code={code} st={st} />)}</div></>)}

      {empty.length > 0 && (<><div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.textTri, marginBottom: 12 }}>Not Yet Configured ({empty.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>{empty.map(([code, st]) => <StateCard key={code} code={code} st={st} />)}</div></>)}

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing} — ${form.name}` : ""} width={640}>
        {editing && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Contact Name"><input value={form.contact || ""} onChange={e => updateForm("contact", e.target.value)} placeholder="Dr. Jane Smith" style={S.input} /></Field>
            <Field label="Phone"><input value={form.phone || ""} onChange={e => updateForm("phone", e.target.value)} placeholder="(555) 123-4567" style={S.input} /></Field>
          </div>
          <Field label="Email"><input value={form.email || ""} onChange={e => updateForm("email", e.target.value)} placeholder="feed@state.gov" style={S.input} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Processing Time"><input value={form.processingTime || ""} onChange={e => updateForm("processingTime", e.target.value)} placeholder="30-45 days" style={S.input} /></Field>
            <Field label="Fees"><input value={form.fees || ""} onChange={e => updateForm("fees", e.target.value)} placeholder="$50-$200" style={S.input} /></Field>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><I n="calendar" s={14} c={C.orange} /> Deadlines <span style={{ fontSize: 11, color: C.textTri, fontWeight: 400 }}>({(form.deadlines || []).length}/5)</span></label>
              {(form.deadlines || []).length < 5 && <button onClick={() => updateForm("deadlines", [...(form.deadlines || []), { title: "", month: 1, day: 1 }])} style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 12 }}><I n="plus" s={12} c={C.textSec} /> Add</button>}
            </div>
            {(form.deadlines || []).length === 0 && <div style={{ fontSize: 13, color: C.textTri, fontStyle: "italic", padding: "8px 0" }}>No deadlines set. Add up to 5 recurring deadlines.</div>}
            {(form.deadlines || []).map((dl, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderLight}`, marginBottom: 6, background: C.surfaceAlt }}>
                <input value={dl.title} onChange={e => { const d = [...form.deadlines]; d[i] = { ...d[i], title: e.target.value }; updateForm("deadlines", d); }} placeholder="e.g. License Renewal" style={{ ...S.input, flex: 1, padding: "8px 10px", fontSize: 13 }} />
                <select value={dl.month} onChange={e => { const d = [...form.deadlines]; d[i] = { ...d[i], month: parseInt(e.target.value) }; updateForm("deadlines", d); }} style={{ ...S.select, width: 110, padding: "8px 30px 8px 10px", fontSize: 13 }}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, mi) => <option key={mi} value={mi + 1}>{m}</option>)}
                </select>
                <select value={dl.day} onChange={e => { const d = [...form.deadlines]; d[i] = { ...d[i], day: parseInt(e.target.value) }; updateForm("deadlines", d); }} style={{ ...S.select, width: 70, padding: "8px 30px 8px 10px", fontSize: 13 }}>
                  {Array.from({ length: 31 }, (_, k) => k + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={() => { const d = [...form.deadlines]; d.splice(i, 1); updateForm("deadlines", d); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><I n="x" s={14} c={C.red} /></button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Required Documents</label>
            {(form.requirements || []).map((req, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.borderLight}`, marginBottom: 6 }}>
                <I n="file" s={14} c={C.teal} /><span style={{ flex: 1, fontSize: 14 }}>{req}</span>
                <button onClick={() => removeReq(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><I n="x" s={14} c={C.red} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newReq} onChange={e => setNewReq(e.target.value)} onKeyDown={e => e.key === "Enter" && addReq()} placeholder="Add a required document..." style={{ ...S.input, flex: 1 }} />
              <button onClick={addReq} style={{ ...S.btn("outline"), padding: "8px 14px" }}><I n="plus" s={14} c={C.textSec} /> Add</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><I n="mapPin" s={14} c={C.primary} /> How to Submit</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" checked={form.submissionMethod === "online"} onChange={() => updateForm("submissionMethod", "online")} /> Online
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" checked={form.submissionMethod === "mail" || !form.submissionMethod} onChange={() => updateForm("submissionMethod", "mail")} /> Mail (Check)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input type="radio" checked={form.submissionMethod === "both"} onChange={() => updateForm("submissionMethod", "both")} /> Both
              </label>
            </div>
            {(form.submissionMethod === "online" || form.submissionMethod === "both") && (
              <Field label="Online Portal URL"><input value={form.onlinePortalUrl || ""} onChange={e => updateForm("onlinePortalUrl", e.target.value)} placeholder="https://state.gov/feed-registration-portal" style={S.input} /></Field>
            )}
            {(form.submissionMethod === "mail" || form.submissionMethod === "both" || !form.submissionMethod) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Check Payable To"><input value={form.checkPayee || ""} onChange={e => updateForm("checkPayee", e.target.value)} placeholder="State Dept of Agriculture" style={S.input} /></Field>
                <Field label="Mailing Address"><textarea value={form.mailingAddress || ""} onChange={e => updateForm("mailingAddress", e.target.value)} placeholder="123 Main St&#10;City, ST 12345" rows={2} style={{ ...S.input, resize: "vertical" }} /></Field>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><I n="file" s={14} c={C.primary} /> Registration Form</label>
            <FileUploadBtn label="Upload state's registration form PDF" fileName={form.registrationFormFile ? form.registrationFormFile.split("/").pop() : null} filePath={form.registrationFormFile} onUpload={handleFormFileUpload} uploading={uploadingForm} db={db} />
            <Field label="Or paste URL" note="If you prefer to link instead of uploading">
              <input value={form.registrationFormUrl || ""} onChange={e => updateForm("registrationFormUrl", e.target.value)} placeholder="https://state.gov/feed-registration-form.pdf" style={S.input} />
            </Field>
          </div>

          <Field label="Notes"><textarea value={form.notes || ""} onChange={e => updateForm("notes", e.target.value)} placeholder="Any notes about this state's requirements..." rows={3} style={{ ...S.input, resize: "vertical" }} /></Field>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setEditing(null)} style={S.btn("outline")}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...S.btn("primary"), opacity: saving ? 0.5 : 1 }}>{saving ? <><Spinner size={16} /> Saving...</> : "Save to GitHub"}</button>
          </div>
        </div>)}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsPage({ settings, onSave, products, config, saving }) {
  const [alertDays, setAlertDays] = useState(String(settings.alertDays || 10));
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled !== false);
  const handleSave = () => onSave({ ...settings, alertDays: parseInt(alertDays) || 10, emailEnabled });
  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800 }}>Settings</h1><p style={{ margin: "0 0 28px", color: C.textSec }}>Configure alerts, notifications, and preferences</p>
      <div style={{ maxWidth: 600 }}>
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><I n="github" s={18} c={C.text} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>GitHub Connection</h3></div>
          <p style={{ margin: "0 0 12px", color: C.textSec, fontSize: 13 }}>Your data repository</p>
          <div style={{ padding: "10px 14px", borderRadius: 8, background: C.greenLight, border: `1px solid ${C.greenBorder}`, display: "flex", alignItems: "center", gap: 8 }}><I n="check" s={16} c={C.green} /><span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Connected to {config.owner}/{config.repo}</span></div>
        </div>
        <div style={{ ...S.card, marginBottom: 20 }}>
          <Field label="Days before deadline to trigger alert"><input type="number" value={alertDays} onChange={e => setAlertDays(e.target.value)} style={{ ...S.input, width: 120 }} /></Field>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div onClick={() => setEmailEnabled(!emailEnabled)} style={{ width: 44, height: 24, borderRadius: 12, background: emailEnabled ? C.primary : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}><div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: emailEnabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} /></div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Email alerts for approaching deadlines</span>
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Products</h3>
          {products.length === 0 && <p style={{ color: C.textTri, fontSize: 14 }}>No products registered yet.</p>}
          {products.map((p, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderLight}`, marginBottom: 8 }}><I n="cat" s={18} c={C.primary} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 12, color: C.textSec }}>{p.type}{p.labelFile ? " • Label uploaded" : ""}{p.gaFile ? " • GA uploaded" : ""}</div></div></div>))}
        </div>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btn("primary"), opacity: saving ? 0.5 : 1 }}>{saving ? <><Spinner size={16} /> Saving...</> : "Save Settings"}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION MODAL — per-registration actions
// ═══════════════════════════════════════════════════════════════════════════════

function ActionModal({ reg, deadlineCtx, open, onClose, onUpdate, stateReqs, saving, db, products }) {
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [approvalFile, setApprovalFile] = useState(null);
  const [approvalFilePath, setApprovalFilePath] = useState("");
  const [uploadingApproval, setUploadingApproval] = useState(false);
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);

  useEffect(() => { if (reg) { setDocs(reg.documents?.map(d => ({ ...d })) || []); setStatus(reg.status); setDeadline(reg.deadline || ""); setNotes(reg.notes || ""); setApprovalFile(null); setApprovalFilePath(""); setShowApprovalPrompt(false); } }, [reg, deadlineCtx]);
  if (!reg) return null;
  const st = stateReqs[reg.state];
  const product = products?.find(p => p.name === reg.productName);

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const handleUpload = async (idx, file) => {
    if (!db) return;
    setUploadingIdx(idx);
    try {
      const b64 = await fileToBase64(file);
      const slug = reg.productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const docSlug = docs[idx].name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/registrations/${slug}/${reg.state}/${docSlug}.${ext}`;
      await db.uploadFile(path, b64, `Upload ${docs[idx].name} for ${reg.productName} in ${reg.state}`);
      const u = [...docs];
      u[idx] = { ...u[idx], uploaded: true, file: file.name, filePath: path };
      setDocs(u);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingIdx(-1);
  };

  const handleApprovalUpload = async (file) => {
    if (!db || !deadlineCtx) return;
    setUploadingApproval(true);
    try {
      const b64 = await fileToBase64(file);
      const slug = reg.productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ttlSlug = deadlineCtx.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/approvals/${slug}/${reg.state}/${ttlSlug}_${deadlineCtx.year}.${ext}`;
      await db.uploadFile(path, b64, `Approval for ${reg.productName} ${reg.state} ${deadlineCtx.title} ${deadlineCtx.year}`);
      setApprovalFile(file.name);
      setApprovalFilePath(path);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingApproval(false);
  };

  const handleStatusClick = (s) => {
    if (s === "Approved" && deadlineCtx) {
      // When acting on a specific deadline, "Approved" means approve THIS deadline only
      setShowApprovalPrompt(true);
      return; // Don't change overall reg status
    }
    setStatus(s);
  };

  const handleSave = () => {
    const ct = docs.filter(d => d.uploaded).length;
    let approvals = reg.approvals || {};
    let saveStatus = status;
    // If approving a specific deadline instance, record the approval but keep reg status unchanged
    if (showApprovalPrompt && deadlineCtx) {
      approvals = {
        ...approvals,
        [deadlineCtx.instanceKey]: {
          date: new Date().toISOString().split("T")[0],
          file: approvalFile || "",
          filePath: approvalFilePath || "",
          year: deadlineCtx.year,
        },
      };
      // Don't change the overall registration status when approving a single deadline
      saveStatus = reg.status;
    }
    onUpdate({ ...reg, documents: docs, uploadedDocs: ct, status: saveStatus, deadline: reg.deadline || "", notes, approvals, lastActionDate: new Date().toISOString().split("T")[0] });
  };

  const submissionMethod = st?.submissionMethod || "mail";
  const steps = ["Pending", "In Review", "Approved"];
  const currentStep = steps.indexOf(status);

  return (
    <Modal open={open} onClose={onClose} title="Registration Action" width={680}>
      <div style={{ marginBottom: 14, fontSize: 14, color: C.textSec }}>Manage <strong>{reg.productName}</strong> in <strong>{reg.stateName}</strong></div>

      {/* Deadline context — prominent */}
      {deadlineCtx && (
        <div style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${C.orange}`, background: C.orangeLight, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 54, textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase" }}>{new Date(deadlineCtx.nextDate).toLocaleDateString("en-US", { month: "short" })}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>{new Date(deadlineCtx.nextDate).getDate()}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textTri }}>{deadlineCtx.year}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Acting on deadline</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{deadlineCtx.title}</div>
            <div style={{ fontSize: 12, color: C.textSec }}>{deadlineCtx.nextDate}</div>
          </div>
        </div>
      )}

      {/* Status Stepper */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, background: C.bg, borderRadius: 10, padding: 4, border: `1px solid ${C.borderLight}` }}>
          {steps.map((s, i) => {
            const active = i === currentStep;
            const past = i < currentStep;
            const reached = i <= currentStep;
            return (
              <div key={s} onClick={() => handleStatusClick(s)} style={{
                flex: 1, padding: "10px 12px", textAlign: "center", cursor: "pointer", borderRadius: 8,
                background: active ? C.primary : "transparent",
                color: active ? "#fff" : reached ? C.primary : C.textTri,
                fontWeight: active ? 700 : reached ? 600 : 500,
                fontSize: 13,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                position: "relative",
              }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: active ? "#fff" : reached ? C.primary : C.border, color: active ? C.primary : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {past ? "✓" : i + 1}
                </div>
                {s}
                {i < steps.length - 1 && <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", color: reached && i < currentStep ? C.primary : C.border, fontSize: 16, pointerEvents: "none" }}>›</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {["Expired", "Rejected"].map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{
              ...S.btn("outline"),
              padding: "5px 12px",
              fontSize: 12,
              background: status === s ? (s === "Expired" ? C.greyLight : C.redLight) : "transparent",
              color: status === s ? (s === "Expired" ? C.grey : C.red) : C.textTri,
              borderColor: status === s ? (s === "Expired" ? C.greyBorder : C.redBorder) : C.border,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Approval confirmation prompt */}
      {showApprovalPrompt && deadlineCtx && (
        <div style={{ padding: 16, borderRadius: 10, border: `2px solid ${C.green}`, background: C.greenLight, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <I n="check" s={18} c={C.green} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.green }}>Upload approval document</span>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: C.textSec }}>Please upload the registration confirmation from <strong>{reg.stateName}</strong> — it will be archived and tagged with year <strong>{deadlineCtx.year}</strong>.</p>
          <FileUploadBtn label="Approval document" fileName={approvalFile} filePath={approvalFilePath} onUpload={handleApprovalUpload} uploading={uploadingApproval} db={db} />
        </div>
      )}

      {/* State Office Contact */}
      {st && (st.contact || st.email || st.phone || st.fees) && (<div style={{ padding: 16, borderRadius: 10, border: `1px solid ${C.borderLight}`, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><I n="mapPin" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>State Office</span></div>
        {(st.contact || st.email || st.phone) && <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
          {st.contact && <>{st.contact}<br /></>}
          {[st.email, st.phone].filter(Boolean).join(" • ")}
        </div>}
        {st.fees && <div style={{ marginTop: 8, fontSize: 14 }}>Fees: <strong>{st.fees}</strong></div>}
      </div>)}

      {/* How to Submit */}
      {st && (st.onlinePortalUrl || st.mailingAddress || st.checkPayee) && (<div style={{ padding: 16, borderRadius: 10, border: `1px solid ${C.primary}40`, background: C.primaryFaint, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><I n="zap" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>How to Submit</span></div>
        {(submissionMethod === "online" || submissionMethod === "both") && st.onlinePortalUrl && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.textTri, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Online Portal</div>
            <a href={st.onlinePortalUrl} target="_blank" rel="noopener noreferrer" style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 13, textDecoration: "none" }}><I n="link" s={14} c={C.primary} /> Open submission portal</a>
          </div>
        )}
        {(submissionMethod === "mail" || submissionMethod === "both" || !submissionMethod) && (st.checkPayee || st.mailingAddress) && (
          <div style={{ display: "flex", gap: 16 }}>
            {st.checkPayee && <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.textTri, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Make Check Payable To</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{st.checkPayee}</div>
            </div>}
            {st.mailingAddress && <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.textTri, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Mail To</div>
              <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{st.mailingAddress}</div>
            </div>}
          </div>
        )}
      </div>)}

      {/* Upcoming Deadlines */}
      {reg.upcomingDeadlines?.length > 0 && (<div style={{ padding: 16, borderRadius: 10, border: `1px solid ${C.orangeBorder}`, background: C.orangeLight, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><I n="calendar" s={16} c={C.orange} /><span style={{ fontWeight: 700, fontSize: 14 }}>Upcoming Deadlines</span></div>
        {reg.upcomingDeadlines.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < reg.upcomingDeadlines.length - 1 ? `1px solid ${C.orangeBorder}` : "none" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: C.textSec }}>{d.nextDate}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.daysLeft < 10 ? C.red : d.daysLeft < 30 ? C.orange : C.teal, background: d.daysLeft < 10 ? C.redLight : d.daysLeft < 30 ? C.orangeLight : C.tealLight, padding: "2px 8px", borderRadius: 10 }}>{d.daysLeft}d</span>
            </div>
          </div>
        ))}
      </div>)}

      {/* Notes */}
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes for this registration..." style={{ ...S.input, resize: "vertical" }} /></Field>

      {/* ALL DOCUMENTS — consolidated at bottom */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><I n="file" s={16} c={C.purple} /><span style={{ fontWeight: 700, fontSize: 14 }}>All Documents</span></div>

        {/* State registration form */}
        {st && (st.registrationFormFile || st.registrationFormUrl) && (<>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.textTri, letterSpacing: 0.5, marginBottom: 6 }}>State form</div>
          {st.registrationFormFile ? (
            <FileDisplay label="Blank registration form" filePath={st.registrationFormFile} db={db} />
          ) : (
            <a href={st.registrationFormUrl} target="_blank" rel="noopener noreferrer" style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 13, textDecoration: "none", marginBottom: 8, display: "inline-flex" }}><I n="download" s={14} c={C.primary} /> Download form from state website</a>
          )}
        </>)}

        {/* Product-level docs */}
        {product && (product.labelFilePath || product.gaFilePath) && (<>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.textTri, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>Product documents</div>
          {product.labelFilePath && <FileDisplay label="Product Label / Artwork" filePath={product.labelFilePath} db={db} />}
          {product.gaFilePath && <FileDisplay label="Guaranteed Analysis" filePath={product.gaFilePath} db={db} />}
        </>)}

        {/* Registration-specific required docs (merged with product docs if they overlap) */}
        {docs.length > 0 && (<>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.textTri, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>Required for submission</div>
          {docs.filter(doc => {
            // Skip if it's already shown as a product-level doc (Label or GA)
            const lower = doc.name.toLowerCase();
            if (product?.labelFilePath && (lower.includes("label") || lower.includes("artwork"))) return false;
            if (product?.gaFilePath && (lower.includes("guaranteed") || lower.includes("analysis"))) return false;
            return true;
          }).map((doc) => {
            const origIdx = docs.indexOf(doc);
            return <FileUploadBtn key={origIdx} label={doc.name} fileName={doc.uploaded ? doc.file : null} filePath={doc.filePath} onUpload={(file) => handleUpload(origIdx, file)} uploading={uploadingIdx === origIdx} db={db} />;
          })}
        </>)}

        {docs.length === 0 && !product?.labelFilePath && !product?.gaFilePath && !st?.registrationFormFile && !st?.registrationFormUrl && <p style={{ fontSize: 13, color: C.textTri, margin: 0 }}>No documents required for this state (configure in Library).</p>}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={S.btn("outline")}>Close</button>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btn("primary"), opacity: saving ? 0.5 : 1 }}>{saving ? <><Spinner size={16} /> Saving...</> : "Save to GitHub"}</button>
      </div>
    </Modal>
  );
}

// Small component: display a pre-uploaded file with Download & Print buttons
function FileDisplay({ label, filePath, db }) {
  const [working, setWorking] = useState(false);
  const handleDownload = async () => {
    if (!db) return;
    setWorking(true);
    try {
      const blob = await db.downloadFile(filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filePath.split("/").pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Download failed: " + e.message); }
    setWorking(false);
  };
  const handlePrint = async () => {
    if (!db) return;
    setWorking(true);
    try {
      const blob = await db.downloadFile(filePath);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) win.addEventListener("load", () => { try { win.print(); } catch(_) {} });
    } catch (e) { alert("Print failed: " + e.message); }
    setWorking(false);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.greenBorder}`, background: C.greenLight, marginBottom: 8 }}>
      <I n="file" s={18} c={C.green} />
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div><div style={{ fontSize: 11, color: C.green, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{filePath.split("/").pop()}</div></div>
      <button onClick={handleDownload} disabled={working} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12 }}><I n="download" s={14} c={C.textSec} /> Download</button>
      <button onClick={handlePrint} disabled={working} style={{ ...S.btn("outline"), padding: "6px 12px", fontSize: 12 }}><I n="printer" s={14} c={C.textSec} /> Print</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW REGISTRATION MODAL — with product file uploads, per-state deadlines
// ═══════════════════════════════════════════════════════════════════════════════

function NewRegModal({ open, onClose, onCreate, stateReqs, saving, db }) {
  const [name, setName] = useState(""); const [type, setType] = useState("Pet Treat"); const [desc, setDesc] = useState("");
  const [labelFile, setLabelFile] = useState(null); const [gaFile, setGaFile] = useState(null);
  const [uploadingLabel, setUploadingLabel] = useState(false); const [uploadingGa, setUploadingGa] = useState(false);
  const [selStates, setSelStates] = useState([]);
  const allCodes = Object.keys(stateReqs);
  const toggle = (c) => setSelStates(p => p.includes(c) ? p.filter(s => s !== c) : [...p, c]);
  const toggleAll = () => setSelStates(p => p.length === allCodes.length ? [] : [...allCodes]);
  const valid = name && selStates.length > 0;

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const [labelPath, setLabelPath] = useState("");
  const [gaPath, setGaPath] = useState("");

  const handleLabelUpload = async (file) => {
    if (!db || !name) { alert("Enter a product name first."); return; }
    setUploadingLabel(true);
    try {
      const b64 = await fileToBase64(file);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/products/${slug}/label.${ext}`;
      await db.uploadFile(path, b64, `Upload label for ${name}`);
      setLabelFile(file.name);
      setLabelPath(path);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingLabel(false);
  };

  const handleGaUpload = async (file) => {
    if (!db || !name) { alert("Enter a product name first."); return; }
    setUploadingGa(true);
    try {
      const b64 = await fileToBase64(file);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/products/${slug}/guaranteed_analysis.${ext}`;
      await db.uploadFile(path, b64, `Upload GA for ${name}`);
      setGaFile(file.name);
      setGaPath(path);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingGa(false);
  };

  const handleCreate = () => {
    if (!valid) return;
    onCreate({ name, type, description: desc, states: selStates, labelFile: labelFile || "", gaFile: gaFile || "", labelFilePath: labelPath, gaFilePath: gaPath });
    setName(""); setType("Pet Treat"); setDesc(""); setSelStates([]); setLabelFile(null); setGaFile(null); setLabelPath(""); setGaPath("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Register New Product" width={640}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><I n="cat" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>Product Information</span></div>
        <Field label="Product Name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Salmon Purrfection Treats" style={S.input} /></Field>
        <Field label="Product Type *"><select value={type} onChange={e => setType(e.target.value)} style={{ ...S.select, width: "100%" }}><option>Pet Treat</option><option>Cat Supplement</option></select></Field>
        <Field label="Description"><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Additional notes" rows={2} style={{ ...S.input, resize: "vertical" }} /></Field>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><I n="upload" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>Product Documents</span></div>
        {!name && <div style={{ fontSize: 12, color: C.orange, marginBottom: 8 }}>Enter a product name above before uploading files.</div>}
        <FileUploadBtn label="Product Label / Artwork" fileName={labelFile} onUpload={handleLabelUpload} uploading={uploadingLabel} />
        <FileUploadBtn label="Guaranteed Analysis" fileName={gaFile} onUpload={handleGaUpload} uploading={uploadingGa} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><I n="mapPin" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>State Registration</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }} onClick={toggleAll}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selStates.length === allCodes.length ? C.primary : C.border}`, background: selStates.length === allCodes.length ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{selStates.length === allCodes.length && <I n="check" s={12} c="#fff" />}</div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Register in all states</span>
          {selStates.length > 0 && <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>({selStates.length} selected)</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {allCodes.map(c => { const on = selStates.includes(c); return <span key={c} onClick={() => toggle(c)} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: on ? C.primary : C.bg, color: on ? "#fff" : C.textSec, border: `1px solid ${on ? C.primary : C.border}`, transition: "all 0.15s" }}>{c}</span>; })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={S.btn("outline")}>Cancel</button>
        <button onClick={handleCreate} disabled={!valid || saving} style={{ ...S.btn("primary"), opacity: (!valid || saving) ? 0.5 : 1 }}>{saving ? <><Spinner size={16} /> Creating...</> : "Register Product"}</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

function Sidebar({ page, onNavigate, registrations, syncing, products, onEditProduct }) {
  const byType = useMemo(() => {
    const m = {};
    registrations.forEach(r => {
      if (!m[r.productType]) m[r.productType] = new Set();
      m[r.productType].add(r.productName);
    });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
  }, [registrations]);
  const [openType, setOpenType] = useState(null);
  const nav = [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }, { id: "deadlines", label: "Deadlines", icon: "calendar" }, { id: "registrations", label: "Registrations", icon: "list" }, { id: "library", label: "State Library", icon: "library" }, { id: "settings", label: "Settings", icon: "settings" }];
  return (
    <div style={{ width: 240, minHeight: "100vh", background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px 14px", display: "flex", flexDirection: "column", boxSizing: "border-box", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "0 8px" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}><I n="cat" s={18} c="#fff" /></div>
        <div><div style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>LicenseWatcher</div><div style={{ fontSize: 11, color: C.textTri, display: "flex", alignItems: "center", gap: 4 }}>{syncing ? <><Spinner size={10} /> Syncing...</> : <><div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} /> Connected</>}</div></div>
      </div>
      <button onClick={() => onNavigate("new")} style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", marginTop: 16, marginBottom: 20, borderRadius: 10 }}><I n="plus" s={16} c="#fff" /> Register New Product</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{nav.map(item => { const a = page === item.id; return (<div key={item.id} onClick={() => onNavigate(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: a ? C.primaryLight : "transparent", color: a ? C.primary : C.textSec, fontWeight: a ? 600 : 500, fontSize: 14, transition: "all 0.15s" }}><I n={item.icon} s={18} c={a ? C.primary : C.textSec} />{item.label}</div>); })}</div>
      {Object.keys(byType).length > 0 && (
        <div style={{ marginTop: 28, padding: "0 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.textTri, marginBottom: 10 }}>Product Types</div>
          {Object.entries(byType).map(([type, prodNames]) => {
            const open = openType === type;
            return (
              <div key={type} style={{ marginBottom: 4 }}>
                <div onClick={() => setOpenType(open ? null : type)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <I n={open ? "chevronDown" : "chevronRight"} s={12} c={C.textTri} />
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: type === "Cat Supplement" ? C.teal : C.primary }} />
                    <span style={{ color: C.textSec, fontWeight: 500 }}>{type}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textTri, background: C.bg, padding: "2px 8px", borderRadius: 10 }}>{prodNames.length}</span>
                </div>
                {open && <div style={{ paddingLeft: 22, marginTop: 2 }}>
                  {prodNames.map(pn => (
                    <div key={pn} onClick={() => onEditProduct(pn)} style={{ padding: "5px 8px", fontSize: 12, color: C.textSec, cursor: "pointer", borderRadius: 4, marginBottom: 1 }} onMouseEnter={e => e.currentTarget.style.background = C.primaryLight} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {pn}
                    </div>
                  ))}
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT EDIT MODAL — edit label/GA files and info for an existing product
// ═══════════════════════════════════════════════════════════════════════════════

function ProductEditModal({ productName, open, onClose, products, registrations, onSaveProduct, saving, db }) {
  const product = products.find(p => p.name === productName);
  const [labelFile, setLabelFile] = useState("");
  const [labelPath, setLabelPath] = useState("");
  const [gaFile, setGaFile] = useState("");
  const [gaPath, setGaPath] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("");
  const [legalCategory, setLegalCategory] = useState("");
  const [uploadingLabel, setUploadingLabel] = useState(false);
  const [uploadingGa, setUploadingGa] = useState(false);

  useEffect(() => {
    if (product) {
      setLabelFile(product.labelFile || "");
      setLabelPath(product.labelFilePath || "");
      setGaFile(product.gaFile || "");
      setGaPath(product.gaFilePath || "");
      setDesc(product.description || "");
      setType(product.type || "Pet Treat");
      setLegalCategory(product.legalCategory || "");
    }
  }, [product]);

  if (!product) return null;

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const handleLabelUpload = async (file) => {
    if (!db) return;
    setUploadingLabel(true);
    try {
      const b64 = await fileToBase64(file);
      const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/products/${slug}/label.${ext}`;
      await db.uploadFile(path, b64, `Update label for ${productName}`);
      setLabelFile(file.name);
      setLabelPath(path);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingLabel(false);
  };

  const handleGaUpload = async (file) => {
    if (!db) return;
    setUploadingGa(true);
    try {
      const b64 = await fileToBase64(file);
      const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const ext = file.name.split(".").pop();
      const path = `uploads/products/${slug}/guaranteed_analysis.${ext}`;
      await db.uploadFile(path, b64, `Update GA for ${productName}`);
      setGaFile(file.name);
      setGaPath(path);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploadingGa(false);
  };

  const handleSave = () => {
    onSaveProduct({ ...product, description: desc, type, legalCategory, labelFile, labelFilePath: labelPath, gaFile, gaFilePath: gaPath });
  };

  const productRegs = registrations.filter(r => r.productName === productName);

  return (
    <Modal open={open} onClose={onClose} title={`Edit: ${productName}`} width={640}>
      <div style={{ marginBottom: 16, fontSize: 14, color: C.textSec }}>
        Registered in <strong>{productRegs.length}</strong> state{productRegs.length === 1 ? "" : "s"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Product Type">
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...S.select, width: "100%" }}>
            <option>Pet Treat</option>
            <option>Cat Supplement</option>
            <option>Dog Food</option>
            <option>Cat Food</option>
            <option>Specialty Pet Food</option>
          </select>
        </Field>
        <Field label="Legal Categorization" note="e.g. AAFCO specialty pet food, medicated feed">
          <input value={legalCategory} onChange={e => setLegalCategory(e.target.value)} placeholder="e.g. Specialty Pet Food" style={S.input} />
        </Field>
      </div>

      <Field label="Description"><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Additional notes" style={{ ...S.input, resize: "vertical" }} /></Field>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><I n="file" s={16} c={C.teal} /><span style={{ fontWeight: 700, fontSize: 14 }}>Product Documents</span></div>
        <FileUploadBtn label="Product Label / Artwork" fileName={labelFile} filePath={labelPath} onUpload={handleLabelUpload} uploading={uploadingLabel} db={db} />
        <FileUploadBtn label="Guaranteed Analysis" fileName={gaFile} filePath={gaPath} onUpload={handleGaUpload} uploading={uploadingGa} db={db} />
      </div>

      {productRegs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><I n="mapPin" s={16} c={C.primary} /><span style={{ fontWeight: 700, fontSize: 14 }}>State Registrations</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {productRegs.map(r => (<span key={r.id} style={{ ...S.badge(C.primaryLight, C.primary, C.primary + "30"), fontSize: 12 }}>{r.state} — {r.status}</span>))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={S.btn("outline")}>Close</button>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btn("primary"), opacity: saving ? 0.5 : 1 }}>{saving ? <><Spinner size={16} /> Saving...</> : "Save to GitHub"}</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState(null);
  const [db, setDb] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [registrations, setRegistrations] = useState([]);
  const [products, setProducts] = useState([]);
  const [stateReqs, setStateReqs] = useState(DEFAULT_STATES);
  const [settings, setSettings] = useState({ alertDays: 10, emailEnabled: true });
  const [actionReg, setActionReg] = useState(null);
  const [actionDeadlineCtx, setActionDeadlineCtx] = useState(null);
  const [showNewReg, setShowNewReg] = useState(false);
  const [editProductName, setEditProductName] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const log = useCallback((action, detail = "", level = "info") => {
    const entry = { time: new Date().toISOString(), action, detail, level };
    setActivityLog(prev => [entry, ...prev].slice(0, 200));
    if (level === "error") console.error(`[LW] ${action}: ${detail}`);
    else console.log(`[LW] ${action}: ${detail}`);
  }, []);

  const showToast = (msg, type = "success") => { setToast({ message: msg, type, key: Date.now() }); log(type === "error" ? "Error" : "Success", msg, type === "error" ? "error" : "info"); };

  // Helper: get next occurrence of a month/day deadline
  const getNextOccurrence = useCallback((month, day) => {
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), month - 1, day);
    const nextYear = new Date(now.getFullYear() + 1, month - 1, day);
    return thisYear >= now ? thisYear : nextYear;
  }, []);

  const enrichRegs = useCallback((regs, stReqs) => {
    const now = new Date();
    return regs.map(r => {
      // Get deadlines from the state config
      const stateData = stReqs?.[r.state];
      const stateDeadlines = stateData?.deadlines || [];

      // Generate ALL deadline instances rolling 12 months forward
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today
      const horizonEnd = new Date(today);
      horizonEnd.setFullYear(horizonEnd.getFullYear() + 1);
      const approvals = r.approvals || {};

      const upcomingDeadlines = [];
      stateDeadlines.filter(d => d.title && d.month && d.day).forEach(d => {
        // Generate next few years to cover 12-month window regardless of date position
        for (let yearOffset = -1; yearOffset <= 2; yearOffset++) {
          const date = new Date(now.getFullYear() + yearOffset, d.month - 1, d.day);
          if (date >= today && date <= horizonEnd) {
            const daysLeft = Math.ceil((date - now) / 86400000);
            const year = date.getFullYear();
            const instanceKey = `${d.title}_${year}`;
            const approval = approvals[instanceKey];
            upcomingDeadlines.push({
              title: d.title,
              month: d.month,
              day: d.day,
              year,
              instanceKey,
              nextDate: date.toISOString().split("T")[0],
              daysLeft,
              approved: !!approval,
              approvalDate: approval?.date,
              approvalFile: approval?.file,
              approvalFilePath: approval?.filePath,
            });
          }
        }
      });
      upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);

      // Nearest non-approved deadline drives priority
      const nearestActive = upcomingDeadlines.find(d => !d.approved);
      const daysLeft = nearestActive ? nearestActive.daysLeft : 999;
      const priority = daysLeft < 0 ? "Critical" : daysLeft < 10 ? "High" : daysLeft < 30 ? "Medium" : "Low";
      const nearestDeadlineLabel = nearestActive?.title || null;

      return { ...r, daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel };
    });
  }, []);

  const loadData = useCallback(async (database) => {
    setLoading(true);
    try {
      const [regs, prods, sreqs, sett] = await Promise.all([database.read("data/registrations.json"), database.read("data/products.json"), database.read("data/state-offices.json"), database.read("data/settings.json")]);
      const sr = sreqs || DEFAULT_STATES;
      setStateReqs(sr);
      setRegistrations(enrichRegs(regs || [], sr));
      setProducts(prods || []);
      setSettings(sett || { alertDays: 10, emailEnabled: true });
    } catch (e) { showToast("Failed to load: " + e.message, "error"); }
    setLoading(false);
  }, [enrichRegs]);

  const handleConnect = async (cfg) => { log("Connect", `${cfg.owner}/${cfg.repo}`); const database = new GitHubDB(cfg.token, cfg.repo, cfg.owner); setDb(database); setConfig(cfg); setConnected(true); await loadData(database); };

  const saveRegs = useCallback(async (newRegs) => {
    if (!db) return; setSyncing(true);
    log("SaveRegs", `Saving ${newRegs.length} registrations`);
    try {
      const toSave = newRegs.map(({ daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...rest }) => rest);
      await db.write("data/registrations.json", toSave, "Update registrations");
      setRegistrations(enrichRegs(newRegs, stateReqs)); showToast("Saved to GitHub");
    } catch (e) { showToast("Save failed: " + e.message, "error"); }
    setSyncing(false);
  }, [db, enrichRegs]);

  const saveProducts = useCallback(async (newProds) => {
    if (!db) return;
    try { await db.write("data/products.json", newProds, "Update products"); setProducts(newProds); } catch (e) { showToast("Save failed: " + e.message, "error"); }
  }, [db]);

  // Create registrations — per-state deadlines, product files
  const handleCreate = async ({ name, type, description, states, labelFile, gaFile, labelFilePath, gaFilePath }) => {
    setSyncing(true);
    const now = new Date();
    const newRegs = states.map((st, i) => {
      const sr = stateReqs[st];
      return {
        id: `reg_${Date.now()}_${i}`, productName: name, productType: type, state: st, stateName: sr?.name || st,
        status: "Pending", deadline: "", totalDocs: sr?.requirements?.length || 0, uploadedDocs: 0,
        documents: (sr?.requirements || []).map(r => ({ name: r, uploaded: false, file: null })),
        notes: description, createdAt: now.toISOString().split("T")[0], approvals: {},
      };
    });
    const all = [...registrations.map(({ daysLeft, priority, ...r }) => r), ...newRegs];
    if (!products.find(p => p.name === name)) await saveProducts([...products, { name, type, description, labelFile, gaFile, labelFilePath: labelFilePath || "", gaFilePath: gaFilePath || "", createdAt: now.toISOString().split("T")[0] }]);
    await saveRegs(all); setSyncing(false);
  };

  const handleUpdate = async (updated) => {
    log("Update", `${updated.productName} in ${updated.state}: status=${updated.status}, approvals=${JSON.stringify(updated.approvals || {})}`);
    setSyncing(true);
    const { daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...clean } = updated;
    const newRegs = registrations.map(r => r.id === updated.id ? clean : (() => { const { daysLeft: dl, priority: pr, upcomingDeadlines: ud, nearestDeadlineLabel: ndl, ...rest } = r; return rest; })());
    await saveRegs(newRegs); closeAction(); setSyncing(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this registration?")) return;
    log("Delete", `Registration ${id}`);
    const newRegs = registrations.filter(r => r.id !== id).map(({ daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...r }) => r);
    await saveRegs(newRegs);
  };

  // Wrapper for opening Action modal with optional deadline context
  const handleAction = (reg, deadlineCtx = null) => {
    log("OpenAction", `${reg.productName} in ${reg.state}${deadlineCtx ? ` — deadline: ${deadlineCtx.title} ${deadlineCtx.year}` : ""}`);
    setActionReg(reg);
    setActionDeadlineCtx(deadlineCtx);
  };
  const closeAction = () => { setActionReg(null); setActionDeadlineCtx(null); };

  // Quick status update from Registrations page (no modal)
  const handleUpdateRegStatus = async (id, newStatus) => {
    const reg = registrations.find(r => r.id === id);
    if (!reg) return;
    const updated = { ...reg, status: newStatus, lastActionDate: new Date().toISOString().split("T")[0] };
    const newRegs = registrations.map(r => r.id === id ? updated : r);
    await saveRegs(newRegs);
  };

  // Bulk operations from Registrations page
  const handleBulkUpdate = async ({ action, productNames, newType }) => {
    if (!db) return; setSyncing(true);
    try {
      if (action === "delete") {
        const newRegs = registrations.filter(r => !productNames.includes(r.productName)).map(({ daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...r }) => r);
        const newProducts = products.filter(p => !productNames.includes(p.name));
        await db.write("data/registrations.json", newRegs, `Bulk delete ${productNames.length} products`);
        await db.write("data/products.json", newProducts, `Remove ${productNames.length} products`);
        setRegistrations(enrichRegs(newRegs, stateReqs));
        setProducts(newProducts);
        showToast(`Deleted ${productNames.length} product(s)`);
      } else if (action === "changeType") {
        const newRegs = registrations.map(r => productNames.includes(r.productName) ? { ...r, productType: newType } : r).map(({ daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...r }) => r);
        const newProducts = products.map(p => productNames.includes(p.name) ? { ...p, type: newType } : p);
        await db.write("data/registrations.json", newRegs, `Bulk change type for ${productNames.length} products`);
        await db.write("data/products.json", newProducts, `Update product types`);
        setRegistrations(enrichRegs(newRegs, stateReqs));
        setProducts(newProducts);
        showToast(`Updated type for ${productNames.length} product(s)`);
      }
    } catch (e) { showToast("Bulk update failed: " + e.message, "error"); }
    setSyncing(false);
  };

  const handleSaveState = async (code, data) => {
    if (!db) return; setSyncing(true);
    try {
      const updated = { ...stateReqs, [code]: data };
      await db.write("data/state-offices.json", updated, `Update state: ${code}`);
      setStateReqs(updated); showToast(`${data.name} updated`);
    } catch (e) { showToast("Save failed: " + e.message, "error"); }
    setSyncing(false);
  };

  const handleBulkSave = async (allStates) => {
    if (!db) return; setSyncing(true);
    try {
      await db.write("data/state-offices.json", allStates, "Bulk update state offices from CSV");
      setStateReqs(allStates); showToast("All states updated from CSV");
    } catch (e) { showToast("Bulk save failed: " + e.message, "error"); }
    setSyncing(false);
  };

  const handleSaveSettings = async (newSettings) => {
    if (!db) return; setSyncing(true);
    try { await db.write("data/settings.json", newSettings, "Update settings"); setSettings(newSettings); showToast("Settings saved"); } catch (e) { showToast("Save failed: " + e.message, "error"); }
    setSyncing(false);
  };

  const handleSaveProduct = async (updated) => {
    if (!db) return; setSyncing(true);
    try {
      const newProducts = products.map(p => p.name === updated.name ? updated : p);
      await db.write("data/products.json", newProducts, `Update product: ${updated.name}`);
      setProducts(newProducts);

      // If the type changed, cascade to registrations
      const oldProduct = products.find(p => p.name === updated.name);
      if (oldProduct && oldProduct.type !== updated.type) {
        const newRegs = registrations.map(r => r.productName === updated.name ? { ...r, productType: updated.type } : r).map(({ daysLeft, priority, upcomingDeadlines, nearestDeadlineLabel, ...r }) => r);
        await db.write("data/registrations.json", newRegs, `Update type for ${updated.name} registrations`);
        setRegistrations(enrichRegs(newRegs, stateReqs));
      }

      showToast(`${updated.name} updated`);
      setEditProductName(null);
    } catch (e) { showToast("Save failed: " + e.message, "error"); }
    setSyncing(false);
  };

  const handleNavigate = (p) => { if (p === "new") { setShowNewReg(true); return; } setPage(p); };

  if (!connected) return <SetupPage onConnect={handleConnect} />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", color: C.text }}>
      <Sidebar page={page} onNavigate={handleNavigate} registrations={registrations} syncing={syncing} products={products} onEditProduct={setEditProductName} />
      <div style={{ flex: 1, padding: "28px 36px", maxWidth: 1200, overflowX: "auto" }}>
        {loading ? (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}><Spinner size={32} /><div style={{ fontSize: 15, color: C.textSec }}>Loading from GitHub...</div></div>) : (<>
          {page === "dashboard" && <DashboardPage registrations={registrations} onNavigate={handleNavigate} onAction={handleAction} />}
          {page === "deadlines" && <DeadlinesPage registrations={registrations} stateReqs={stateReqs} onAction={handleAction} onEditProduct={setEditProductName} />}
          {page === "registrations" && <ProductsPage registrations={registrations} stateReqs={stateReqs} products={products} onEditProduct={setEditProductName} onBulkUpdate={handleBulkUpdate} onUpdateRegStatus={handleUpdateRegStatus} saving={syncing} onNewReg={() => setShowNewReg(true)} />}
          {page === "library" && <LibraryPage stateReqs={stateReqs} onSaveState={handleSaveState} onBulkSave={handleBulkSave} saving={syncing} db={db} />}
          {page === "settings" && <SettingsPage settings={settings} onSave={handleSaveSettings} products={products} config={config} saving={syncing} />}
        </>)}
      </div>
      <ActionModal reg={actionReg} deadlineCtx={actionDeadlineCtx} open={!!actionReg} onClose={closeAction} onUpdate={handleUpdate} stateReqs={stateReqs} saving={syncing} db={db} products={products} />
      <NewRegModal open={showNewReg} onClose={() => setShowNewReg(false)} onCreate={handleCreate} stateReqs={stateReqs} saving={syncing} db={db} />
      <ProductEditModal productName={editProductName} open={!!editProductName} onClose={() => setEditProductName(null)} products={products} registrations={registrations} onSaveProduct={handleSaveProduct} saving={syncing} db={db} />
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Activity Log */}
      <button onClick={() => setShowLog(!showLog)} style={{ position: "fixed", bottom: 20, left: 260, zIndex: 1500, width: 36, height: 36, borderRadius: 18, background: activityLog.some(e => e.level === "error") ? C.red : C.textTri, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} title="Activity Log">
        {activityLog.some(e => e.level === "error") ? "!" : "📋"}
      </button>
      {showLog && (
        <div style={{ position: "fixed", bottom: 64, left: 260, zIndex: 1500, width: 520, maxHeight: 400, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Activity Log</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { const text = activityLog.map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.action}: ${e.detail}`).join("\n"); navigator.clipboard?.writeText(text); showToast("Log copied to clipboard"); }} style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 11 }}>Copy All</button>
              <button onClick={() => setActivityLog([])} style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 11 }}>Clear</button>
              <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><I n="x" s={16} c={C.textSec} /></button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 8, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6 }}>
            {activityLog.length === 0 && <div style={{ color: C.textTri, padding: 16, textAlign: "center" }}>No activity yet.</div>}
            {activityLog.map((e, i) => (
              <div key={i} style={{ padding: "4px 8px", borderRadius: 4, marginBottom: 2, background: e.level === "error" ? C.redLight : "transparent", color: e.level === "error" ? C.red : C.textSec }}>
                <span style={{ color: C.textTri }}>{e.time.split("T")[1]?.split(".")[0] || e.time}</span>{" "}
                <span style={{ fontWeight: 700, color: e.level === "error" ? C.red : C.text }}>{e.action}</span>{" "}
                {e.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
