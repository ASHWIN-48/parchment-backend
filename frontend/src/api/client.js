const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export async function uploadPDF(file, sessionId) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: {
      session_id: sessionId,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return response.json();
}

export async function askQuestion(question, sessionId) {
  const response = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      session_id: sessionId,
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error("Question failed");
  }

  return response.json();
}

export async function getDocuments(sessionId) {
  const response = await fetch(`${API_BASE}/documents`, {
    headers: {
      session_id: sessionId,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch documents");
  }

  return response.json();
}

export async function deleteDocument(documentId, sessionId) {
  const response = await fetch(
    `${API_BASE}/documents/${documentId}`,
    {
      method: "DELETE",
      headers: {
        session_id: sessionId,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete document");
  }

  return response.json();
}