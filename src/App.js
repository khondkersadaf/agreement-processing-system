import { useState, useCallback, useRef, useEffect, useId } from "react";
import { api, setToken, clearToken, getToken, normalizeRequest } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens / constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = { BUSINESS: "business", LEGAL: "legal", CXO: "cxo", ADMIN: "admin" };

const BUSINESS_UNITS = [
  "Finance", "Operations", "Sales", "Marketing", "HR",
  "Technology", "Legal", "Executive",
  "RedX-3PL", "RedX-FTL", "Mokam", "Porshi", "PLB",
];

const STATUS = {
  PENDING:        "pending",
  IN_REVIEW:      "in_review",
  DRAFT_SHARED:   "draft_shared",
  FEEDBACK_GIVEN: "feedback_given",
  FINAL_SHARED:   "final_shared",
  ACCEPTED:       "accepted",
  CXO_REQUESTED:  "cxo_requested",
  CXO_APPROVED:   "cxo_approved",
  CXO_REJECTED:   "cxo_rejected",
  SIGNED:         "signed",
};

// Single source of truth for all status presentation
const STATUS_CONFIG = {
  [STATUS.PENDING]:        { label: "Awaiting review",        badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-400",   pulse: false },
  [STATUS.IN_REVIEW]:      { label: "In review",               badge: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500",    pulse: true  },
  [STATUS.DRAFT_SHARED]:   { label: "Draft ready for review",  badge: "bg-teal-50 text-teal-700 border-teal-200",      dot: "bg-teal-500",    pulse: true  },
  [STATUS.FEEDBACK_GIVEN]: { label: "Feedback in progress",    badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",   pulse: false },
  [STATUS.FINAL_SHARED]:   { label: "Final version ready",     badge: "bg-teal-50 text-teal-700 border-teal-200",      dot: "bg-teal-500",    pulse: true  },
  [STATUS.ACCEPTED]:       { label: "Accepted by business",    badge: "bg-teal-50 text-teal-700 border-teal-200",      dot: "bg-teal-500",    pulse: false },
  [STATUS.CXO_REQUESTED]:  { label: "Pending CXO review",      badge: "bg-violet-50 text-violet-700 border-violet-200",dot: "bg-violet-500",  pulse: true  },
  [STATUS.CXO_APPROVED]:   { label: "CXO approved",            badge: "bg-violet-50 text-violet-700 border-violet-200",dot: "bg-violet-400",  pulse: false },
  [STATUS.CXO_REJECTED]:   { label: "Rejected by CXO",         badge: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-500",     pulse: false },
  [STATUS.SIGNED]:         { label: "Signed & archived",       badge: "bg-emerald-700 text-white border-transparent",  dot: "bg-emerald-300", pulse: false },
};

const ROLE_CONFIG = {
  [ROLES.BUSINESS]: { label: "Business", color: "bg-teal-500",   ring: "ring-teal-200"   },
  [ROLES.LEGAL]:    { label: "Legal",    color: "bg-amber-500",  ring: "ring-amber-200"  },
  [ROLES.CXO]:      { label: "CXO",      color: "bg-violet-500", ring: "ring-violet-200" },
  [ROLES.ADMIN]:    { label: "Admin",    color: "bg-red-500",    ring: "ring-red-200"    },
};

// For timeline avatars
const ROLE_AVATAR = {
  [ROLES.BUSINESS]: { bg: "bg-teal-50",   border: "border-teal-200",   text: "text-teal-700",   action: "bg-teal-50 text-teal-700 border-teal-200"   },
  [ROLES.LEGAL]:    { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  action: "bg-amber-50 text-amber-700 border-amber-200"  },
  [ROLES.CXO]:      { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", action: "bg-violet-50 text-violet-700 border-violet-200" },
};

const ALLOWED_TYPES = {
  all:  { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/msword": "doc", "image/png": "png", "image/jpeg": "jpg" },
  docx: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/msword": "doc" },
  pdf:  { "application/pdf": "pdf" },
};
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const fmtSize = (b) =>
  b < 1024 ? `${b} B` :
  b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` :
  `${(b / 1_048_576).toFixed(1)} MB`;

const getExt = (name) => name.split(".").pop().toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Primitive — Icon
// ─────────────────────────────────────────────────────────────────────────────

const ICON_PATHS = {
  file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  filePdf:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2a1.5 1.5 0 0 1 0 3H9z"/></>,
  fileDoc:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></>,
  plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  send:     <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
  check:    <><polyline points="20 6 9 17 4 12"/></>,
  x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  upload:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  award:    <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>,
  arrow:    <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  back:     <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  msg:      <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  clip:     <><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></>,
  img:      <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  key:      <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
  logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
};

function Icon({ name, size = 16, className = "", "aria-hidden": ariaHidden = true }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — StatusBadge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, size = "md" }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const sizes = {
    sm: "h-5 px-2 text-[11px] gap-1",
    md: "h-[26px] px-2.5 text-xs gap-1.5",
    lg: "h-8 px-3 text-sm gap-1.5",
  };
  const dotSizes = { sm: "size-1.5", md: "size-2", lg: "size-2" };

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border select-none whitespace-nowrap",
        sizes[size], cfg.badge
      )}
    >
      <span className="relative flex shrink-0" aria-hidden="true">
        {cfg.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping", cfg.dot)} />
        )}
        <span className={cn("relative inline-flex rounded-full", dotSizes[size], cfg.dot)} />
      </span>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — ActionButton
// ─────────────────────────────────────────────────────────────────────────────

const BTN_VARIANTS = {
  primary: "bg-brand-500 text-white shadow-btn hover:brightness-105",
  gold:    "bg-amber-500 text-white shadow-btn hover:brightness-105",
  outline: "bg-transparent text-teal-700 border border-teal-600 hover:bg-teal-50",
  danger:  "bg-red-500 text-white shadow-btn hover:brightness-105",
};

function ActionButton({ label, icon, onClick, variant = "primary", disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold",
        "tracking-[0.01em] transition-[filter,transform] duration-150",
        "active:scale-[0.975]",
        "disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:brightness-100",
        BTN_VARIANTS[variant]
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — Field (label + control + hint/error)
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, required, hint, error, children }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 mb-1.5 block"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-label="required">*</span>}
      </label>
      {/* Clone child to inject id — or wrap if not an input */}
      <div id={id + "-ctrl"}>
        {children}
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-400 mt-1.5 leading-snug">{hint}</p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-600 mt-1.5 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
          <Icon name="x" size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — Modal
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl p-7 w-[520px] max-h-[88vh] overflow-y-auto shadow-modal border border-gray-200 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — Toast
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ message, type }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-[2000] animate-toast-in",
        "flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-toast",
        "bg-white border text-sm font-medium text-gray-900 whitespace-nowrap",
        isError ? "border-red-200" : "border-emerald-200"
      )}
    >
      <span className={cn(
        "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
        isError ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
      )}>
        <Icon name={isError ? "x" : "check"} size={13} />
      </span>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive — CardSection (reusable titled card)
// ─────────────────────────────────────────────────────────────────────────────

function CardSection({ icon, title, badge, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        {icon && <Icon name={icon} size={16} className="text-brand-500" />}
        <span className="text-sm font-bold text-gray-900">{title}</span>
        {badge != null && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 ml-0.5">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FileUploadZone
// ─────────────────────────────────────────────────────────────────────────────

function FileUploadZone({ accept = "all", multiple = false, onFiles, files = [], onRemove, label, hint }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState("");
  const inputRef                = useRef(null);
  const typeMap                 = ALLOWED_TYPES[accept] || ALLOWED_TYPES.all;
  const acceptStr               = Object.keys(typeMap).join(",");
  const extList                 = Object.values(typeMap).map(e => "." + e).join(", ");

  const validate = (list) => {
    for (const f of list) {
      if (!typeMap[f.type]) { setError(`"${f.name}" isn't supported. Use ${extList}`); return []; }
      if (f.size > MAX_FILE_SIZE) { setError(`"${f.name}" exceeds 25 MB`); return []; }
    }
    setError("");
    return list;
  };

  const handleDrop   = (e) => { e.preventDefault(); setDragging(false); const v = validate([...e.dataTransfer.files]); if (v.length) onFiles(multiple ? v : [v[0]]); };
  const handleChange = (e) => { const v = validate([...e.target.files]); if (v.length) onFiles(multiple ? v : [v[0]]); e.target.value = ""; };

  const fileIconName = (f) => {
    const ext = getExt(f.name);
    return ext === "pdf" ? "filePdf" : ["doc","docx"].includes(ext) ? "fileDoc" : ["png","jpg","jpeg"].includes(ext) ? "img" : "file";
  };

  const fileStyle = (f) => {
    const ext = getExt(f.name);
    if (ext === "pdf")           return { row: "bg-red-50 border-red-100",   icon: "text-red-600",  name: "text-red-800" };
    if (["doc","docx"].includes(ext)) return { row: "bg-teal-50 border-teal-100", icon: "text-teal-600", name: "text-teal-800" };
    return { row: "bg-gray-50 border-gray-200", icon: "text-gray-500", name: "text-gray-700" };
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label || "Upload files"}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={cn(
          "rounded-xl border-2 border-dashed text-center cursor-pointer transition-all duration-200",
          files.length > 0 ? "py-4 px-4" : "py-7 px-5",
          dragging ? "border-brand-400 bg-brand-50" : error ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            "rounded-xl flex items-center justify-center",
            files.length > 0 ? "w-9 h-9 rounded-lg" : "w-11 h-11",
            dragging ? "bg-brand-100 text-brand-500" : "bg-gray-200 text-gray-400"
          )}>
            <Icon name="upload" size={files.length > 0 ? 18 : 22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {files.length > 0 ? "Drop more or click to replace" : (label || "Drop files here or click to browse")}
            </p>
            <p className="text-xs text-gray-400 mt-1">{hint || `${extList} · max 25 MB`}</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept={acceptStr} multiple={multiple} onChange={handleChange} className="hidden" aria-hidden="true" />
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
          <Icon name="x" size={12} />
          {error}
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5" role="list">
          {files.map((f, i) => {
            const s = fileStyle(f);
            return (
              <li key={i} className={cn("flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border animate-slide-up", s.row)}>
                <div className={cn("w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0", s.icon)}>
                  <Icon name={fileIconName(f)} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", s.name)}>{f.name}</p>
                  <p className="text-[11px] text-gray-400">{fmtSize(f.size)} · {getExt(f.name).toUpperCase()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                  aria-label={`Remove ${f.name}`}
                  className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

function TimelineItem({ entry, isLast, onFileClick }) {
  const { actor, role, action, detail, date, file } = entry;
  const av = ROLE_AVATAR[role] || { bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-600", action: "bg-gray-100 text-gray-600 border-gray-200" };
  const initials = actor.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const isPdf = file?.type === "pdf";

  return (
    <div className="flex gap-3 pt-4 animate-slide-up">
      {/* Avatar column */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full border-2 flex items-center justify-center",
          "text-[11px] font-bold",
          av.bg, av.border, av.text
        )}>
          {initials}
        </div>
        {!isLast && <div className="w-px flex-1 min-h-4 mt-1.5 bg-gray-100" aria-hidden="true" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1", isLast ? "pb-2" : "pb-0")}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{actor}</span>
            <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap", av.action)}>
              {action}
            </span>
          </div>
          <time className="text-[11px] text-gray-400 shrink-0">{date}</time>
        </div>

        {/* Detail */}
        {detail && <p className="text-sm text-gray-500 leading-relaxed">{detail}</p>}

        {/* Attached file */}
        {file && (
          <button
            onClick={() => onFileClick(file)}
            className={cn(
              "mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium",
              "transition-opacity hover:opacity-75 cursor-pointer",
              isPdf ? "bg-red-50 border-red-100 text-red-800" : "bg-teal-50 border-teal-100 text-teal-800"
            )}
          >
            <Icon name={isPdf ? "filePdf" : "fileDoc"} size={13} />
            <span>{file.name}</span>
            {file.size && <span className="text-gray-400">{fmtSize(file.size)}</span>}
            <Icon name="eye" size={11} className="text-gray-300" />
          </button>
        )}
      </div>
    </div>
  );
}

function Timeline({ history, onFile }) {
  const entries = [...history].reverse();
  return (
    <div className="px-6 pb-2" role="list" aria-label="Activity history">
      {entries.map((h, i) => (
        <div role="listitem" key={i}>
          <TimelineItem entry={h} isLast={i === entries.length - 1} onFileClick={onFile} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PreviewModal
// ─────────────────────────────────────────────────────────────────────────────

function PreviewModal({ file, onClose }) {
  useEffect(() => {
    if (!file) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [file, onClose]);

  if (!file) return null;
  const isImage = file.dataUrl?.startsWith("data:image");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${file.name}`}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-auto shadow-modal min-w-96 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-base font-bold text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {[file.type?.toUpperCase(), file.size && fmtSize(file.size), file.uploadedBy].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Content */}
        {isImage ? (
          <img src={file.dataUrl} alt={file.name} className="w-full rounded-xl max-h-[500px] object-contain bg-gray-100" />
        ) : file.dataUrl ? (
          <div className="flex flex-col items-center gap-4 py-10 rounded-xl bg-gray-50 text-center">
            <Icon name={file.type === "pdf" ? "filePdf" : "fileDoc"} size={48} className="text-gray-300" />
            <p className="text-sm text-gray-400">Preview not available for this file type</p>
            <a
              href={file.dataUrl}
              download={file.name}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:brightness-105 transition-all"
            >
              <Icon name="download" size={15} />
              Download
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 rounded-xl bg-gray-50 text-center">
            <Icon name="file" size={48} className="text-gray-200" />
            <p className="text-sm text-gray-400">Sample file — no preview available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChangePwdModal
// ─────────────────────────────────────────────────────────────────────────────

function ChangePwdModal({ open, onClose, onSuccess }) {
  const [cur,     setCur]     = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const reset = () => { setCur(""); setNext(""); setConfirm(""); setErrors({}); };
  const close = () => { reset(); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!cur)               errs.cur     = "Please enter your current password.";
    if (next.length < 6)    errs.next    = "New password must be at least 6 characters.";
    else if (next !== confirm) errs.confirm = "Passwords don't match — please try again.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await api.changePassword(cur, next);
      reset();
      onSuccess();
    } catch (err) {
      setErrors({ cur: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Change password">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Current password" error={errors.cur}>
          <input
            type="password"
            className={cn("lf-input", errors.cur && "lf-input-error")}
            value={cur}
            onChange={e => { setCur(e.target.value); setErrors(p => ({ ...p, cur: "" })); }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" hint="At least 6 characters" error={errors.next}>
          <input
            type="password"
            className={cn("lf-input", errors.next && "lf-input-error")}
            value={next}
            onChange={e => { setNext(e.target.value); setErrors(p => ({ ...p, next: "" })); }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <input
            type="password"
            className={cn("lf-input", errors.confirm && "lf-input-error")}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <button type="submit" disabled={loading} className="lf-btn-primary mt-1">{loading ? "Saving…" : "Save new password"}</button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar (shared across pages)
// ─────────────────────────────────────────────────────────────────────────────

function Navbar({ user, subtitle, onChangePwd, onLogout }) {
  const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG[ROLES.ADMIN];
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-50 shadow-[0_1px_0_0_#f3f4f6]">

      {/* ── Left: Brand ── */}
      <div className="flex items-center gap-4">
        {/* Logo cropped to actual artwork bounds: original viewBox 0 0 512 512,
            artwork spans x=35..399 y=192..321 → crop to that region */}
        <svg
          viewBox="30 185 480 145"
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-auto shrink-0"
          aria-label="SU Legal"
          role="img"
        >
          <g transform="translate(35.000000, 191.999347)">
            <path d="M293,64.8161537 L293,1.00065313 L311.726854,1.00065313 L311.726854,66.0197913 C311.726854,75.3861029 318.865406,82.7441891 328.297442,82.7441891 C337.729477,82.7441891 345.273146,75.3861029 345.273146,66.0197913 L345.273146,1.00065313 L364,1.00065313 L364,64.8161537 C364,88.0940498 348.909396,100.000653 328.431391,100.000653 C307.953387,100.000653 293,88.0940498 293,64.8161537 M424.014514,65.6500692 C424.014514,55.3493298 416.228983,47.7219163 406.028377,47.7219163 C396.09792,47.7219163 388.849435,55.7483821 388.849435,65.6500692 C388.849435,75.5485119 396.09792,83.7112395 406.028377,83.7112395 C416.228983,83.7112395 424.014514,75.9508085 424.014514,65.6500692 M389.38648,92.6753159 L389.38648,130.001302 L371,130.001302 L371,32.337316 L389.38648,32.337316 L389.38648,39.9647296 C393.679588,34.7446069 400.52773,31.0006531 409.517544,31.0006531 C424.685007,31.0006531 442.000651,42.1027413 442.000651,65.7830866 C442.000651,89.3304144 424.014514,100.568764 409.787694,100.568764 C400.928073,100.568764 393.679588,97.6229151 389.38648,92.6753159" fill="#FDD301"/>
            <path d="M0,83.3595018 L16.9642327,69.8918772 C21.7745985,78.2421963 29.3869618,83.0917168 38.0682953,83.0917168 C47.5529761,83.0917168 52.6289648,76.8967401 52.6289648,70.1629279 C52.6289648,62.0836594 42.8786611,59.5233738 32.4610609,56.2936258 C19.3677959,52.2507259 4.80712647,47.1334204 4.80712647,28.2807054 C4.80712647,12.5271115 18.4348765,0 37.2681873,0 C53.1634499,0 62.246457,6.0610842 70.1276825,14.2775108 L54.7669051,25.9914705 C50.7598866,19.9336519 45.0166014,16.7006383 37.4009988,16.7006383 C28.7196653,16.7006383 24.0453502,21.4130006 24.0453502,27.6079773 C24.0453502,35.1484102 33.3939803,37.7086957 43.8148198,41.2094944 C57.0376569,45.5201793 72,51.4441053 72,70.2968203 C72,85.9197874 59.7100823,101.000653 38.2043461,101.000653 C20.5695775,101.000653 8.81738426,93.4602203 0,83.3595018 M77,1.00065313 L95.2106531,1.00065313 L95.2106531,39.2591656 C99.6301786,33.8908634 106.056513,30.5344538 113.690829,30.5344538 C129.492013,30.5344538 139,40.7371578 139,58.0563619 L139,99.0006531 L120.386686,99.0006531 L120.386686,60.6054101 C120.386686,51.4770176 116.233436,46.2421905 108.066569,46.2421905 C101.104436,46.2421905 95.3437909,51.0733369 95.3437909,62.3503525 L95.3437909,99.0006531 L77,99.0006531 L77,1.00065313 Z M195.284831,66.0006531 C195.284831,56.4427348 187.825983,48.5006531 178.5,48.5006531 C169.041573,48.5006531 161.847612,56.4427348 161.847612,66.0006531 C161.847612,75.5585714 169.041573,83.5006531 178.5,83.5006531 C187.825983,83.5006531 195.284831,75.5585714 195.284831,66.0006531 M144,66.0006531 C144,46.6171426 159.318258,31.0006531 178.5,31.0006531 C197.681742,31.0006531 213,46.6171426 213,66.0006531 C213,85.3841637 197.681742,101.000653 178.5,101.000653 C159.318258,101.000653 144,85.3841637 144,66.0006531 M271.014028,65.6500692 C271.014028,55.3493298 263.228569,47.7219163 253.028055,47.7219163 C243.09769,47.7219163 235.849271,55.7483821 235.849271,65.6500692 C235.849271,75.5485119 243.09769,83.7112395 253.028055,83.7112395 C263.228569,83.7112395 271.014028,75.9508085 271.014028,65.6500692 M236.386312,92.6753159 L236.386312,130.001302 L218,130.001302 L218,32.337316 L236.386312,32.337316 L236.386312,39.9647296 C240.67938,34.7446069 247.527459,31.0006531 256.517191,31.0006531 C271.684515,31.0006531 289,42.1027413 289,65.7830866 C289,89.3304144 271.014028,100.568764 256.787338,100.568764 C247.927799,100.568764 240.67938,97.6229151 236.386312,92.6753159" fill="#37B4AF"/>
          </g>
        </svg>
        {subtitle && (
          <div className="flex items-center gap-3.5">
            <span className="w-px h-5 bg-gray-200 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">{subtitle}</span>
          </div>
        )}
      </div>

      {/* ── Right: User + actions ── */}
      <div className="flex items-center gap-1.5">

        {onChangePwd && (
          <button
            onClick={onChangePwd}
            aria-label="Change password"
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icon name="key" size={13} />
            Password
          </button>
        )}

        {/* Divider */}
        <span className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />

        {/* User chip */}
        <div className="flex items-center gap-2.5 h-8 pl-1 pr-3 rounded-lg border border-gray-200 bg-gray-50">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white tracking-wide shrink-0",
            rc.color
          )}>
            {initials}
          </div>
          <div className="flex items-center gap-2 leading-none">
            <span className="text-[13px] font-semibold text-gray-800">{user.name}</span>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
              rc.color.replace("bg-", "text-").replace("-500", "-600"),
              rc.color.replace("bg-", "bg-").replace("-500", "-50")
            )}>{rc.label}</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={onLogout}
          aria-label="Sign out"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Icon name="logout" size={15} />
        </button>

      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminPage
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { v: ROLES.BUSINESS, l: "Business", dotColor: "bg-teal-500"   },
  { v: ROLES.LEGAL,    l: "Legal",    dotColor: "bg-amber-500"  },
  { v: ROLES.CXO,      l: "CXO",      dotColor: "bg-violet-500" },
  { v: ROLES.ADMIN,    l: "Admin",    dotColor: "bg-red-500"    },
];

function AdminPage({ user, onLogout }) {
  const [users,         setUsers]         = useState([]);
  const [form,          setForm]          = useState({ name: "", email: "", password: "", role: ROLES.BUSINESS });
  const [formError,     setFormError]     = useState("");
  const [formSuccess,   setFormSuccess]   = useState("");
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Please fill in all fields to continue."); return;
    }
    try {
      const newUser = await api.createUser(form);
      setUsers(prev => [...prev, newUser]);
      setForm({ name: "", email: "", password: "", role: ROLES.BUSINESS });
      setFormError("");
      setFormSuccess("User added — they can sign in right away.");
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        user={user}
        subtitle="Admin panel"
        onChangePwd={() => setShowChangePwd(true)}
        onLogout={onLogout}
      />

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[1fr_360px] gap-6 items-start">
        {/* Users table */}
        <CardSection icon="users" title="Users" badge={users.length}>
          <ul role="list">
            {users.map((u, i) => {
              const rc = ROLE_OPTIONS.find(r => r.v === u.role);
              const initials = u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <li
                  key={u.id}
                  className={cn(
                    "flex items-center justify-between px-6 py-3.5",
                    i < users.length - 1 && "border-b border-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white", rc?.dotColor ?? "bg-gray-400")}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-lg border",
                      rc?.dotColor?.replace("bg-", "text-") ?? "text-gray-500",
                      "bg-white border-gray-200"
                    )}>
                      {rc?.l}
                    </span>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        aria-label={`Remove ${u.name}`}
                        className="lf-btn-ghost text-xs text-red-600 border-red-100 hover:bg-red-50"
                      >
                        <Icon name="trash" size={12} />
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardSection>

        {/* Add user form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="plus" size={15} className="text-brand-500" />
            <h2 className="text-sm font-bold text-gray-900">Add a user</h2>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Field label="Full name" required>
              <input className="lf-input" value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormError(""); }} placeholder="Jane Smith" autoComplete="name" />
            </Field>
            <Field label="Email" required>
              <input type="email" className="lf-input" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormError(""); }} placeholder="jane@legalflow.com" autoComplete="email" />
            </Field>
            <Field label="Temporary password" required hint="The user can update this after their first sign-in">
              <input type="password" className="lf-input" value={form.password} onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setFormError(""); }} placeholder="••••••••" autoComplete="new-password" />
            </Field>
            <Field label="Role">
              <select className="lf-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLE_OPTIONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </Field>
            {formError && (
              <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                <Icon name="x" size={12} />
                {formError}
              </p>
            )}
            {formSuccess && (
              <p role="status" className="text-xs font-medium text-green-700 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                {formSuccess}
              </p>
            )}
            <button type="submit" className="lf-btn-primary mt-1">Add user</button>
          </form>
        </div>
      </main>

      <ChangePwdModal
        open={showChangePwd}
        onClose={() => setShowChangePwd(false)}
        onSuccess={() => setShowChangePwd(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await api.login(email.trim().toLowerCase(), password);
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError(err.message || "That email or password doesn't look right. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-modal p-10">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4 mb-8 w-full text-center">
          {/* ShopUp logo — parent brand */}
          <svg
            viewBox="30 185 480 145"
            xmlns="http://www.w3.org/2000/svg"
            className="h-9 w-auto"
            style={{ marginLeft: "18px" }}
            aria-label="ShopUp"
            role="img"
          >
            <g transform="translate(35.000000, 191.999347)">
              <path d="M293,64.8161537 L293,1.00065313 L311.726854,1.00065313 L311.726854,66.0197913 C311.726854,75.3861029 318.865406,82.7441891 328.297442,82.7441891 C337.729477,82.7441891 345.273146,75.3861029 345.273146,66.0197913 L345.273146,1.00065313 L364,1.00065313 L364,64.8161537 C364,88.0940498 348.909396,100.000653 328.431391,100.000653 C307.953387,100.000653 293,88.0940498 293,64.8161537 M424.014514,65.6500692 C424.014514,55.3493298 416.228983,47.7219163 406.028377,47.7219163 C396.09792,47.7219163 388.849435,55.7483821 388.849435,65.6500692 C388.849435,75.5485119 396.09792,83.7112395 406.028377,83.7112395 C416.228983,83.7112395 424.014514,75.9508085 424.014514,65.6500692 M389.38648,92.6753159 L389.38648,130.001302 L371,130.001302 L371,32.337316 L389.38648,32.337316 L389.38648,39.9647296 C393.679588,34.7446069 400.52773,31.0006531 409.517544,31.0006531 C424.685007,31.0006531 442.000651,42.1027413 442.000651,65.7830866 C442.000651,89.3304144 424.014514,100.568764 409.787694,100.568764 C400.928073,100.568764 393.679588,97.6229151 389.38648,92.6753159" fill="#FDD301"/>
              <path d="M0,83.3595018 L16.9642327,69.8918772 C21.7745985,78.2421963 29.3869618,83.0917168 38.0682953,83.0917168 C47.5529761,83.0917168 52.6289648,76.8967401 52.6289648,70.1629279 C52.6289648,62.0836594 42.8786611,59.5233738 32.4610609,56.2936258 C19.3677959,52.2507259 4.80712647,47.1334204 4.80712647,28.2807054 C4.80712647,12.5271115 18.4348765,0 37.2681873,0 C53.1634499,0 62.246457,6.0610842 70.1276825,14.2775108 L54.7669051,25.9914705 C50.7598866,19.9336519 45.0166014,16.7006383 37.4009988,16.7006383 C28.7196653,16.7006383 24.0453502,21.4130006 24.0453502,27.6079773 C24.0453502,35.1484102 33.3939803,37.7086957 43.8148198,41.2094944 C57.0376569,45.5201793 72,51.4441053 72,70.2968203 C72,85.9197874 59.7100823,101.000653 38.2043461,101.000653 C20.5695775,101.000653 8.81738426,93.4602203 0,83.3595018 M77,1.00065313 L95.2106531,1.00065313 L95.2106531,39.2591656 C99.6301786,33.8908634 106.056513,30.5344538 113.690829,30.5344538 C129.492013,30.5344538 139,40.7371578 139,58.0563619 L139,99.0006531 L120.386686,99.0006531 L120.386686,60.6054101 C120.386686,51.4770176 116.233436,46.2421905 108.066569,46.2421905 C101.104436,46.2421905 95.3437909,51.0733369 95.3437909,62.3503525 L95.3437909,99.0006531 L77,99.0006531 L77,1.00065313 Z M195.284831,66.0006531 C195.284831,56.4427348 187.825983,48.5006531 178.5,48.5006531 C169.041573,48.5006531 161.847612,56.4427348 161.847612,66.0006531 C161.847612,75.5585714 169.041573,83.5006531 178.5,83.5006531 C187.825983,83.5006531 195.284831,75.5585714 195.284831,66.0006531 M144,66.0006531 C144,46.6171426 159.318258,31.0006531 178.5,31.0006531 C197.681742,31.0006531 213,46.6171426 213,66.0006531 C213,85.3841637 197.681742,101.000653 178.5,101.000653 C159.318258,101.000653 144,85.3841637 144,66.0006531 M271.014028,65.6500692 C271.014028,55.3493298 263.228569,47.7219163 253.028055,47.7219163 C243.09769,47.7219163 235.849271,55.7483821 235.849271,65.6500692 C235.849271,75.5485119 243.09769,83.7112395 253.028055,83.7112395 C263.228569,83.7112395 271.014028,75.9508085 271.014028,65.6500692 M236.386312,92.6753159 L236.386312,130.001302 L218,130.001302 L218,32.337316 L236.386312,32.337316 L236.386312,39.9647296 C240.67938,34.7446069 247.527459,31.0006531 256.517191,31.0006531 C271.684515,31.0006531 289,42.1027413 289,65.7830866 C289,89.3304144 271.014028,100.568764 256.787338,100.568764 C247.927799,100.568764 240.67938,97.6229151 236.386312,92.6753159" fill="#37B4AF"/>
            </g>
          </svg>
          {/* SU Legal — product name */}
          <p className="text-lg font-bold text-gray-900 tracking-tight leading-none w-full text-center">SU Legal</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Email">
            <input
              type="email"
              className="lf-input"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="you@legalflow.com"
              autoFocus
              autoComplete="email"
            />
          </Field>
          <Field label="Password" error={error}>
            <input
              type="password"
              className={cn("lf-input", error && "lf-input-error")}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <button type="submit" disabled={loading} className="lf-btn-primary mt-1 w-full justify-center py-3">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MainApp
// ─────────────────────────────────────────────────────────────────────────────

function MainApp({ user, onLogout }) {
  const role = user.role;

  // ── State ──────────────────────────────────────────────────────────────────
  const [requests,      setRequests]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [feedback,      setFeedback]      = useState("");
  const [dashFilter,    setDashFilter]    = useState(null);
  const [showNew,       setShowNew]       = useState(false);
  const [showUpload,    setShowUpload]    = useState(false);
  const [showCxo,       setShowCxo]       = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [uploadType,    setUploadType]    = useState("docx");
  const [uploadFiles,   setUploadFiles]   = useState([]);
  const [uploadNote,    setUploadNote]    = useState("");
  const [preview,       setPreview]       = useState(null);
  const [toast,         setToast]         = useState(null);
  const [newReq,        setNewReq]        = useState({ title: "", type: "draft", businessUnit: "", partyA: "", partyB: "", detail: "", files: [] });
  const [cxoNote,       setCxoNote]       = useState("");

  // ── Load requests ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.getRequests()
      .then(rows => { setRequests(rows.map(normalizeRequest)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const notify   = (message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };
  const readFile = (f) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

  // Refresh a single request from the server and update local state
  const refreshRequest = useCallback(async (id) => {
    try {
      const fresh = await api.getRequest(id);
      const norm  = normalizeRequest(fresh);
      setRequests(prev => prev.map(r => r.id === id ? norm : r));
      setSelected(prev => prev?.id === id ? norm : prev);
      return norm;
    } catch { return null; }
  }, []);

  // Optimistic local update (instant UI) + server sync
  const updateRequestLocal = useCallback((id, fn) => {
    setRequests(prev => prev.map(r => r.id === id ? fn({ ...r }) : r));
    setSelected(prev => prev?.id === id ? fn({ ...prev }) : prev);
  }, []);

  // ── Counts for stat cards ──────────────────────────────────────────────────
  const counts = {
    p: requests.filter(r => r.status === STATUS.PENDING).length,
    a: requests.filter(r => ![STATUS.SIGNED, STATUS.CXO_REJECTED, STATUS.PENDING].includes(r.status)).length,
    c: requests.filter(r => r.status === STATUS.SIGNED).length,
    x: requests.filter(r => r.status === STATUS.CXO_REQUESTED).length,
  };

  const FILTER_FN = {
    p: r => r.status === STATUS.PENDING,
    a: r => ![STATUS.SIGNED, STATUS.CXO_REJECTED, STATUS.PENDING].includes(r.status),
    c: r => r.status === STATUS.SIGNED,
    x: r => r.status === STATUS.CXO_REQUESTED,
  };

  const baseList     = role === ROLES.CXO ? requests.filter(r => [STATUS.CXO_REQUESTED, STATUS.CXO_APPROVED, STATUS.CXO_REJECTED].includes(r.status)) : requests;
  const filteredList = dashFilter ? baseList.filter(FILTER_FN[dashFilter]) : baseList;

  // ── Upload modal config ────────────────────────────────────────────────────
  const UPLOAD_CONFIG = {
    docx:   { title: "Share draft with business",   accept: "docx", label: "Drop your draft here",           hint: ".docx only · max 25 MB", showNote: true  },
    pdf:    { title: "Share final version",          accept: "pdf",  label: "Drop the final document here",  hint: ".pdf only · max 25 MB",  showNote: false },
    signed: { title: "Upload signed agreement",      accept: "pdf",  label: "Drop the signed agreement here", hint: ".pdf only · max 25 MB", showNote: false },
  };
  const uCfg = UPLOAD_CONFIG[uploadType];

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newReq.title.trim()) return;
    try {
      const created = await api.createRequest({
        title: newReq.title, type: newReq.type,
        businessUnit: newReq.businessUnit, partyA: newReq.partyA,
        partyB: newReq.partyB, detail: newReq.detail,
      });

      // Upload any attached files
      for (const f of newReq.files) {
        const dataUrl = await readFile(f);
        await api.uploadDocument(created.id, {
          name: f.name, mimeType: f.type, sizeBytes: f.size, data: dataUrl,
          timelineAction: "Attached file",
          timelineNote: `${f.name} (${fmtSize(f.size)})`,
        });
      }

      const fresh = await api.getRequest(created.id);
      setRequests(prev => [normalizeRequest(fresh), ...prev]);
      setNewReq({ title: "", type: "draft", businessUnit: "", partyA: "", partyB: "", detail: "", files: [] });
      setShowNew(false);
      notify("Request submitted to legal");
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const handleStatusAction = async (reqId, status, timelineAction, timelineNote, extra = {}) => {
    try {
      // Optimistic update
      updateRequestLocal(reqId, r => ({
        ...r, status,
        ...(extra.cxoNote !== undefined ? { cxoNote: extra.cxoNote } : {}),
        history: [...r.history, { date: new Date().toISOString().slice(0, 10), actor: user.name, role, action: timelineAction, detail: timelineNote || "" }],
      }));
      await api.updateRequest(reqId, { status, ...extra });
      await api.addTimeline(reqId, { action: timelineAction, note: timelineNote });
    } catch (err) {
      notify(err.message, "error");
      refreshRequest(reqId);
    }
  };

  const handleUploadShare = async (id) => {
    if (!uploadFiles.length) return;
    const f       = uploadFiles[0];
    const dataUrl = await readFile(f);

    const configs = {
      docx:   { status: STATUS.DRAFT_SHARED,  timelineAction: "Shared draft",          timelineNote: uploadNote.trim() ? `Draft shared — ${uploadNote}` : "Draft shared." },
      pdf:    { status: STATUS.FINAL_SHARED,   timelineAction: "Shared final version",  timelineNote: "Final PDF shared." },
      signed: { status: STATUS.SIGNED,         timelineAction: "Uploaded signed copy",  timelineNote: "Signed agreement archived." },
    };
    const cfg = configs[uploadType];

    try {
      await api.uploadDocument(id, {
        name: f.name, mimeType: f.type, sizeBytes: f.size, data: dataUrl,
        timelineAction: cfg.timelineAction, timelineNote: cfg.timelineNote,
      });
      await api.updateRequest(id, { status: cfg.status });
      await refreshRequest(id);
      notify(uploadType === "docx" ? "Draft shared with business" : uploadType === "pdf" ? "Final version shared" : "Signed agreement uploaded");
    } catch (err) {
      notify(err.message, "error");
    }
    setUploadFiles([]); setUploadNote(""); setShowUpload(false);
  };

  const openUpload  = (type) => { setUploadType(type); setUploadFiles([]); setUploadNote(""); setShowUpload(true); };

  // Load document data for preview (base64 fetched on demand)
  const openDocPreview = async (doc) => {
    if (doc.dataUrl) { setPreview(doc); return; }
    try {
      const full = await api.downloadDoc(selected.id, doc.id);
      const enriched = { ...doc, dataUrl: full.data };
      setPreview(enriched);
    } catch {
      setPreview(doc);
    }
  };

  // ── Derived actions panel content ──────────────────────────────────────────
  const getActions = (req) => {
    if (!req) return null;
    const s = req.status;
    const actions = [];

    if (role === ROLES.LEGAL) {
      if (s === STATUS.PENDING)
        actions.push(<ActionButton key="start" label="Begin review" icon="arrow" onClick={() => { handleStatusAction(req.id, STATUS.IN_REVIEW, "Started review", "Started reviewing the request and attached documents."); notify("Review started"); }} />);
      if ([STATUS.IN_REVIEW, STATUS.FEEDBACK_GIVEN].includes(s))
        actions.push(<ActionButton key="draft" label="Share draft with business" icon="upload" onClick={() => openUpload("docx")} />);
      if ([STATUS.DRAFT_SHARED, STATUS.FEEDBACK_GIVEN, STATUS.IN_REVIEW].includes(s))
        actions.push(<ActionButton key="final" label="Share final version" icon="upload" variant="gold" onClick={() => openUpload("pdf")} />);
    }

    if (role === ROLES.BUSINESS) {
      if (s === STATUS.DRAFT_SHARED) {
        actions.push(
          <div key="feedback" className="flex flex-col gap-2 w-full">
            <textarea
              className="lf-input resize-y leading-relaxed"
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Be specific about what you'd like changed — legal will be notified immediately."
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400">Legal will be notified as soon as you send</p>
              <ActionButton
                label="Send feedback"
                icon="msg"
                disabled={!feedback.trim()}
                onClick={() => { if (!feedback.trim()) return; handleStatusAction(req.id, STATUS.FEEDBACK_GIVEN, "Gave feedback", feedback); setFeedback(""); notify("Feedback sent to legal"); }}
              />
            </div>
          </div>
        );
        actions.push(<ActionButton key="approve" label="Approve this draft" icon="check" variant="outline" onClick={() => { handleStatusAction(req.id, req.status, "Approved draft", "Approved the draft — no further changes requested."); notify("Draft approved"); }} />);
      }
      if (s === STATUS.FINAL_SHARED) {
        actions.push(<ActionButton key="accept" label="Accept legal's version" icon="check" onClick={() => { handleStatusAction(req.id, STATUS.ACCEPTED, "Accepted final version", "Accepted legal's final version — proceeding to signing."); notify("Final version accepted"); }} />);
        actions.push(<ActionButton key="cxo" label="Escalate to CXO" icon="award" variant="gold" onClick={() => setShowCxo(true)} />);
      }
      if ([STATUS.ACCEPTED, STATUS.CXO_APPROVED].includes(s))
        actions.push(<ActionButton key="sign" label="Upload signed agreement" icon="upload" onClick={() => openUpload("signed")} />);
    }

    if (role === ROLES.CXO && s === STATUS.CXO_REQUESTED) {
      actions.push(<ActionButton key="approve" label="Approve changes" icon="check" onClick={() => { handleStatusAction(req.id, STATUS.CXO_APPROVED, "CXO approved", "Approved the requested changes."); notify("Changes approved"); }} />);
      actions.push(<ActionButton key="reject" label="Reject changes" icon="x" variant="danger" onClick={() => { handleStatusAction(req.id, STATUS.CXO_REJECTED, "CXO rejected", "Rejected the requested changes. Legal's version stands."); notify("Changes rejected", "error"); }} />);
    }

    return actions.length ? <div className="flex flex-col gap-2.5">{actions}</div> : null;
  };

  // ── Sub-components ─────────────────────────────────────────────────────────
  const STAT_CARDS = [
    { key: "p", label: "Awaiting review", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  ring: "ring-amber-200",  icon: "file"  },
    { key: "a", label: "In progress",     color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200",   ring: "ring-teal-200",   icon: "arrow" },
    { key: "c", label: "Signed",          color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  ring: "ring-green-200",  icon: "check" },
    { key: "x", label: "Needs CXO",       color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", ring: "ring-violet-200", icon: "award" },
  ];
  const FILTER_LABELS = { p: "Awaiting review", a: "In progress", c: "Signed", x: "Needs CXO" };

  const countValues = { p: counts.p, a: counts.a, c: counts.c, x: counts.x };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Navbar */}
      <Navbar
        user={user}
        subtitle="SU Legal"
        onChangePwd={() => setShowChangePwd(true)}
        onLogout={() => { onLogout(); setSelected(null); }}
      />

      <div className="flex h-[calc(100vh-56px)]">
        {/* ── Sidebar ── */}
        <aside className="w-[400px] shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          {loading && (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          )}
          {!loading && (<>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2 p-4 pb-3">
            {STAT_CARDS.map(card => {
              const active = dashFilter === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => { setDashFilter(active ? null : card.key); setSelected(null); }}
                  aria-pressed={active}
                  aria-label={`Filter by ${card.label}: ${countValues[card.key]}`}
                  className={cn(
                    "lf-stat-card text-left p-3 border",
                    active ? cn(card.bg, card.border, "ring-2", card.ring) : "bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors", active ? cn(card.bg, card.color) : "bg-gray-200 text-gray-400")}>
                      <Icon name={card.icon} size={14} />
                    </div>
                    {active && <span className={cn("w-1.5 h-1.5 rounded-full mt-1", card.color.replace("text-", "bg-"))} aria-hidden="true" />}
                  </div>
                  <p className={cn("text-2xl font-bold leading-none tracking-tight mb-1", active ? card.color : "text-gray-900")}>
                    {countValues[card.key]}
                  </p>
                  <p className={cn("text-[11px] font-medium", active ? card.color : "text-gray-500")}>
                    {card.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* New request CTA */}
          {role === ROLES.BUSINESS && (
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowNew(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white text-sm font-semibold shadow-sm hover:brightness-105 transition-all"
              >
                <Icon name="plus" size={15} />
                New agreement request
              </button>
            </div>
          )}

          {/* Section label */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {dashFilter ? FILTER_LABELS[dashFilter] : "All agreements"}
            </span>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredList.length}
            </span>
          </div>

          {/* Request list */}
          <nav className="flex-1 overflow-y-auto px-2 pb-6" aria-label="Agreements list">
            {filteredList.length > 0 ? (
              filteredList.map((r, i) => {
                const isActive = selected?.id === r.id;
                const meta =[r.createdAt, r.type === "draft" ? "New draft" : "Client review", r.businessUnit].filter(Boolean).join(" · ");
                return (
                  <button
                    key={r.id}
                    onClick={async () => { setSelected(r); setFeedback(""); const full = await api.getRequest(r.id); if (full) setSelected(normalizeRequest(full)); }}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "lf-req-item w-full text-left px-3 py-3 mb-0.5 relative border border-transparent",
                      "animate-slide-up",
                      isActive && "bg-teal-50/50 border-l-2 !border-l-brand-400 !rounded-l-none"
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={cn("text-sm leading-snug flex-1", isActive ? "font-semibold text-gray-900" : "font-medium text-gray-800")}>
                        {r.title}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium shrink-0">{r.displayId}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <StatusBadge status={r.status} size="sm" />
                      {(r.docCount || r.documents?.length) > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Icon name="clip" size={10} />
                          {r.docCount ?? r.documents.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{meta}</p>
                  </button>
                );
              })
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center text-center px-5 py-12 gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Icon name="file" size={22} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-600">
                  {role === ROLES.CXO ? "Nothing needs your attention" : dashFilter ? "No matching agreements" : "No agreements yet"}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {role === ROLES.CXO ? "Escalated agreements will appear here." : dashFilter ? "Try clearing the filter to see all agreements." : role === ROLES.BUSINESS ? "Submit your first request to get started." : "Agreements submitted by business will appear here."}
                </p>
              </div>
            )}
          </nav>
          </>)}
        </aside>

        {/* ── Detail panel ── */}
        <main className="flex-1 overflow-y-auto p-8" key={role}>
          {!selected ? (
            /* Empty detail state */
            <div className="flex flex-col items-center justify-center h-full gap-0 animate-fade-in" role="status">
              <svg width="160" height="130" viewBox="0 0 160 130" fill="none" aria-hidden="true" className="mb-7">
                <rect x="52" y="22" width="72" height="88" rx="8" fill="#E8F9F7" stroke="#99E6E0" strokeWidth="1.5"/>
                <rect x="44" y="14" width="72" height="88" rx="8" fill="#F0FAFA" stroke="#C0EDEA" strokeWidth="1.5"/>
                <rect x="36" y="6"  width="72" height="88" rx="8" fill="#fff"    stroke="#2EBDB1" strokeWidth="1.5"/>
                <rect x="50" y="22" width="44" height="5"  rx="2.5" fill="#2EBDB133"/>
                <rect x="50" y="33" width="36" height="3.5" rx="1.75" fill="#D0E8E6"/>
                <rect x="50" y="41" width="40" height="3.5" rx="1.75" fill="#D0E8E6"/>
                <rect x="50" y="49" width="28" height="3.5" rx="1.75" fill="#D0E8E6"/>
                <rect x="50" y="62" width="44" height="3.5" rx="1.75" fill="#E8EDEC"/>
                <rect x="50" y="70" width="38" height="3.5" rx="1.75" fill="#E8EDEC"/>
                <circle cx="122" cy="94" r="22" fill="#16A34A"/>
                <path d="M113 94l7 7 14-14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">
                {role === ROLES.BUSINESS ? "Ready to move a deal forward?" : role === ROLES.LEGAL ? "Select an agreement to get started" : "Your escalations inbox"}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed text-center max-w-sm mb-7">
                {role === ROLES.BUSINESS && "Submit a request and legal will pick it up. Track progress, share feedback, and get it signed — all in one place."}
                {role === ROLES.LEGAL && "Choose an agreement from the sidebar to review documents, share drafts, and move it through to final sign-off."}
                {role === ROLES.CXO && "When business and legal can't align, it lands here. Select a request to review the full history and approve or reject."}
              </p>
              {role === ROLES.BUSINESS ? (
                <button onClick={() => setShowNew(true)} className="lf-btn-primary px-6 py-3 shadow-lg shadow-brand-500/20">
                  <Icon name="plus" size={15} /> New agreement request
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-500">
                  <Icon name="back" size={14} className="text-gray-400" />
                  Choose an agreement from the list
                </div>
              )}
            </div>
          ) : (
            /* Selected request detail */
            <div className="max-w-[800px] flex flex-col gap-4 animate-slide-up">
              {/* Back */}
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit"
              >
                <Icon name="back" size={14} className="text-gray-400" />
                All agreements
              </button>

              {/* Header card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-6">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-xs font-semibold text-gray-400">{selected.displayId}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
                  <span className="text-xs text-gray-400">{selected.type === "draft" ? "New draft" : "Client review"}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
                  <time className="text-xs text-gray-400">Created {selected.createdAt}</time>
                  {selected.createdBy && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
                      <span className="text-xs text-gray-400">by {selected.createdBy}</span>
                    </>
                  )}
                </div>
                <h1 className="text-[22px] font-bold text-gray-900 leading-snug mb-3">{selected.title}</h1>
                <div className="flex items-center flex-wrap gap-2">
                  <StatusBadge status={selected.status} size="md" />
                  {selected.partyA && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800">{selected.partyA}</span>
                  )}
                  {selected.partyA && selected.partyB && <Icon name="arrow" size={12} className="text-gray-400" />}
                  {selected.partyB && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800">{selected.partyB}</span>
                  )}
                  {selected.businessUnit && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700">{selected.businessUnit}</span>
                  )}
                </div>
              </div>

              {/* CXO note */}
              {selected.cxoNote && role === ROLES.CXO && selected.status === STATUS.CXO_REQUESTED && (
                <div className="flex gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-100 border-l-4 border-l-amber-400">
                  <Icon name="award" size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">Requested changes</p>
                    <p className="text-sm text-amber-900 leading-relaxed">{selected.cxoNote}</p>
                  </div>
                </div>
              )}

              {/* Actions card */}
              {getActions(selected) && (
                <CardSection title="Next steps">
                  <div className="px-6 py-4">
                    {getActions(selected)}
                  </div>
                </CardSection>
              )}

              {/* Documents card */}
              {selected.documents.length > 0 && (
                <CardSection
                  icon="clip"
                  title="Documents"
                  badge={`${selected.documents.length} ${selected.documents.length === 1 ? "file" : "files"}`}
                >
                  <ul role="list">
                    {selected.documents.map((doc, i) => {
                      const isPdf = doc.type === "pdf";
                      const isDoc = ["doc","docx"].includes(doc.type);
                      const clr   = isPdf ? { icon: "text-red-600",  bg: "bg-red-50",  border: "border-red-100",  version: "bg-red-50 text-red-600 border-red-100"   }
                                  : isDoc ? { icon: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100", version: "bg-teal-50 text-teal-700 border-teal-100" }
                                  :         { icon: "text-gray-500",  bg: "bg-gray-50",  border: "border-gray-200", version: "bg-gray-100 text-gray-500 border-gray-200" };
                      const meta  = [doc.date, doc.size && fmtSize(doc.size), doc.uploadedBy].filter(Boolean).join(" · ");
                      return (
                        <li
                          key={i}
                          onClick={() => openDocPreview(doc)}
                          className={cn(
                            "flex items-center gap-3 px-6 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors group",
                            i < selected.documents.length - 1 && "border-b border-gray-50"
                          )}
                        >
                          {/* File icon */}
                          <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", clr.bg, clr.border, clr.icon)}>
                            <Icon name={isPdf ? "filePdf" : isDoc ? "fileDoc" : "file"} size={17} />
                          </div>
                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
                          </div>
                          {/* Version */}
                          {doc.version !== undefined && (
                            <span className={cn(
                              "text-[11px] font-semibold px-2.5 py-1 rounded-lg border shrink-0",
                              doc.version === 0 ? "bg-gray-100 text-gray-500 border-gray-200" : cn(clr.version)
                            )}>
                              {doc.version === 0 ? "Original" : `v${doc.version}`}
                            </span>
                          )}
                          {/* Actions */}
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => openDocPreview(doc)}
                              aria-label={`Preview ${doc.name}`}
                              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
                            >
                              <Icon name="eye" size={13} />
                            </button>
                            {doc.dataUrl && (
                              <a
                                href={doc.dataUrl}
                                download={doc.name}
                                aria-label={`Download ${doc.name}`}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
                              >
                                <Icon name="download" size={13} />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardSection>
              )}

              {/* Activity card */}
              <CardSection
                icon="msg"
                title="Activity"
                badge={`${selected.history.length} ${selected.history.length === 1 ? "update" : "updates"}`}
              >
                <Timeline history={selected.history} onFile={f => setPreview(f)} />
              </CardSection>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}

      {/* New request */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setNewReq({ title: "", type: "draft", businessUnit: "", partyA: "", partyB: "", detail: "", files: [] }); }} title="New agreement request">
        <div className="flex flex-col gap-4">
          <Field label="Request type">
            <div className="flex gap-2">
              {[{ v: "draft", l: "Draft new agreement" }, { v: "review", l: "Review client agreement" }].map(t => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setNewReq(p => ({ ...p, type: t.v }))}
                  aria-pressed={newReq.type === t.v}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all duration-150",
                    newReq.type === t.v ? "border-brand-400 bg-brand-50 text-teal-700 border-2" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Business unit">
            <select className="lf-input" value={newReq.businessUnit} onChange={e => setNewReq(p => ({ ...p, businessUnit: e.target.value }))}>
              <option value="">Select business unit…</option>
              {BUSINESS_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Agreement title" required>
            <input className="lf-input" value={newReq.title} onChange={e => setNewReq(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Vendor partnership — Acme Corp" />
          </Field>
          <div className="flex gap-3">
            <div className="flex-1"><Field label="Party A"><input className="lf-input" value={newReq.partyA} onChange={e => setNewReq(p => ({ ...p, partyA: e.target.value }))} placeholder="e.g. Acme Corp" /></Field></div>
            <div className="flex-1"><Field label="Party B"><input className="lf-input" value={newReq.partyB} onChange={e => setNewReq(p => ({ ...p, partyB: e.target.value }))} placeholder="e.g. RedX" /></Field></div>
          </div>
          <Field label="Background & context" hint="What's the purpose? Any key terms or deadlines legal should know about?">
            <textarea className="lf-input resize-y leading-relaxed" rows={3} value={newReq.detail} onChange={e => setNewReq(p => ({ ...p, detail: e.target.value }))} placeholder="Describe the purpose, key terms, or any specific requirements..." />
          </Field>
          <Field label="Attachments" required={newReq.type === "review"}>
            <FileUploadZone
              accept="all"
              multiple
              onFiles={f => setNewReq(p => ({ ...p, files: [...p.files, ...f] }))}
              files={newReq.files}
              onRemove={i => setNewReq(p => ({ ...p, files: p.files.filter((_, j) => j !== i) }))}
              label={newReq.type === "review" ? "Upload client agreement to review" : "Attach supporting documents (optional)"}
            />
          </Field>
          <button
            type="button"
            className="lf-btn-primary mt-1 w-full justify-center py-2.5"
            onClick={handleCreate}
            disabled={!newReq.title.trim() || (newReq.type === "review" && !newReq.files.length)}
          >
            Submit to legal
          </button>
        </div>
      </Modal>

      {/* Upload / share */}
      <Modal open={showUpload} onClose={() => { setShowUpload(false); setUploadFiles([]); setUploadNote(""); }} title={uCfg?.title}>
        <div className="flex flex-col gap-4">
          <FileUploadZone accept={uCfg?.accept} onFiles={f => setUploadFiles(f)} files={uploadFiles} onRemove={() => setUploadFiles([])} label={uCfg?.label} hint={uCfg?.hint} />
          {uCfg?.showNote && (
            <Field label="Version note" hint="Optional — helps business understand what changed">
              <textarea className="lf-input resize-y leading-relaxed" rows={2} value={uploadNote} onChange={e => setUploadNote(e.target.value)} placeholder="What changed in this version?" />
            </Field>
          )}
          <button
            type="button"
            disabled={!uploadFiles.length}
            onClick={() => selected && handleUploadShare(selected.id)}
            className={cn(
              "lf-btn-primary mt-1 w-full justify-center py-2.5 gap-2",
              !uploadFiles.length ? "" : uploadType !== "docx" ? "bg-amber-500 hover:brightness-105" : ""
            )}
          >
            <Icon name="send" size={15} />
            {uploadType === "signed" ? "Upload & archive" : "Upload & share"}
          </button>
        </div>
      </Modal>

      {/* CXO escalation */}
      <Modal open={showCxo} onClose={() => setShowCxo(false)} title="Escalate to CXO">
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 leading-relaxed">
            You're proposing changes to the final version prepared by legal. CXO will review the full agreement history before deciding.
          </div>
          <Field label="What changes are you requesting?" required hint="Be specific — vague requests are harder to approve.">
            <textarea className="lf-input resize-y leading-relaxed" rows={4} value={cxoNote} onChange={e => setCxoNote(e.target.value)} placeholder="Describe what you'd like changed and why..." />
          </Field>
          <button
            type="button"
            disabled={!cxoNote.trim()}
            onClick={async () => {
              if (!cxoNote.trim() || !selected) return;
              await handleStatusAction(selected.id, STATUS.CXO_REQUESTED, "Escalated to CXO", cxoNote, { cxoNote });
              setCxoNote(""); setShowCxo(false); notify("Sent to CXO for review");
            }}
            className="lf-btn-primary mt-1 w-full justify-center py-2.5 bg-amber-500 hover:brightness-105 disabled:bg-gray-200"
          >
            Send to CXO for review
          </button>
        </div>
      </Modal>

      <PreviewModal file={preview} onClose={() => setPreview(null)} />
      <ChangePwdModal
        open={showChangePwd}
        onClose={() => setShowChangePwd(false)}
        onSuccess={() => { setShowChangePwd(false); notify("Password updated successfully"); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App root — routing
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => {
    // Restore session from token if valid
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) { clearToken(); return null; }
      return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
    } catch { clearToken(); return null; }
  });

  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => { clearToken(); setUser(null); };

  if (!user)                     return <LoginPage onLogin={handleLogin} />;
  if (user.role === ROLES.ADMIN) return <AdminPage user={user} onLogout={handleLogout} />;
  return <MainApp user={user} onLogout={handleLogout} />;
}
