const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getSessionId() {
  let id = localStorage.getItem("parchment_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("parchment_session", id);
  }
  return id;
}

export async function uploadPDF(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: { "session-id": getSessionId() },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function askQuestion(question) {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "session-id": getSessionId()
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDocuments() {
  const res = await fetch(`${BASE_URL}/documents`, {
    headers: { "session-id": getSessionId() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteDocument(documentId) {
  const res = await fetch(`${BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: { "session-id": getSessionId() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}