const BASE = "http://localhost:3000/api";

// ── Token management ─────────────────────────────────────────────────────────
export function getToken()        { return localStorage.getItem("lf_token"); }
export function setToken(t)       { localStorage.setItem("lf_token", t); }
export function clearToken()      { localStorage.removeItem("lf_token"); }

// ── Base fetch ───────────────────────────────────────────────────────────────
async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Normalize helpers ─────────────────────────────────────────────────────────
function getExtFromMime(mime) {
  const map = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  return map[mime] || "file";
}

function normalizeDoc(d) {
  return {
    id:         d.id,
    name:       d.name,
    type:       d.mime_type ? getExtFromMime(d.mime_type) : (d.name.split(".").pop().toLowerCase()),
    size:       d.size_bytes || 0,
    uploadedBy: d.uploaded_by_name || "",
    date:       d.uploaded_at ? d.uploaded_at.slice(0, 10) : "",
    version:    parseInt(d.version ?? 0),
    dataUrl:    d.data || null,
  };
}

function normalizeTimeline(t) {
  return {
    id:     t.id,
    date:   t.created_at ? t.created_at.slice(0, 10) : "",
    actor:  t.actor_name,
    role:   t.actor_role || null,
    action: t.action,
    detail: t.note || "",
  };
}

export function normalizeRequest(r) {
  return {
    id:           r.id,
    displayId:    r.seq ? `REQ-${String(r.seq).padStart(3, "0")}` : r.id.slice(0, 8).toUpperCase(),
    title:        r.title,
    type:         r.type,
    status:       r.status,
    businessUnit: r.business_unit || "",
    partyA:       r.party_a || "",
    partyB:       r.party_b || "",
    detail:       r.detail || "",
    cxoNote:      r.cxo_note || "",
    createdBy:    r.created_by_name || "",
    createdAt:    r.created_at ? r.created_at.slice(0, 10) : "",
    docCount:     r.doc_count || 0,
    documents:    (r.documents || []).map(normalizeDoc),
    history:      (r.timeline  || []).map(normalizeTimeline),
    comments:     r.comments || [],
  };
}

// ── API methods ───────────────────────────────────────────────────────────────
export const api = {
  // Auth
  login:          (email, password)               => req("POST", "/auth/login", { email, password }),
  changePassword: (currentPassword, newPassword)  => req("PUT",  "/auth/password", { currentPassword, newPassword }),

  // Requests
  getRequests:    ()                              => req("GET",  "/requests"),
  getRequest:     (id)                            => req("GET",  `/requests/${id}`),
  createRequest:  (data)                          => req("POST", "/requests", data),
  updateRequest:  (id, data)                      => req("PUT",  `/requests/${id}`, data),

  // Documents
  uploadDocument: (requestId, doc)                => req("POST", `/requests/${requestId}/documents`, doc),
  downloadDoc:    (requestId, docId)              => req("GET",  `/requests/${requestId}/documents/${docId}/download`),

  // Timeline
  addTimeline:    (requestId, data)               => req("POST", `/requests/${requestId}/timeline`, data),

  // Comments
  getComments:    (requestId)                     => req("GET",  `/requests/${requestId}/comments`),
  addComment:     (requestId, body)               => req("POST", `/requests/${requestId}/comments`, { body }),
  deleteComment:  (requestId, commentId)          => req("DELETE", `/requests/${requestId}/comments/${commentId}`),

  // Admin
  getUsers:       ()                              => req("GET",  "/admin/users"),
  createUser:     (data)                          => req("POST", "/admin/users", data),
  deleteUser:     (id)                            => req("DELETE", `/admin/users/${id}`),
};
