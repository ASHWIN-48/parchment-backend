# app/rag.py

def build_rag_prompt(chunks, question):
    context = "\n\n".join(
        f"[Page {c['page_start']}] {c['text']}"
        for c in chunks
    )

    return f"""
You are a study assistant.
Answer the question strictly using the provided context.
If the answer is not in the context, say so clearly.

Context:
{context}

Question:
{question}

Answer:
""".strip()
