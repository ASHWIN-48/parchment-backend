# app/llm.py
# import requests

# OLLAMA_URL = "http://localhost:11434/api/generate"
# OLLAMA_MODEL = "llama3.1:8b"


# def ask_llm(prompt: str) -> str:
#     response = requests.post(
#         OLLAMA_URL,
#         json={
#             "model": OLLAMA_MODEL,
#             "prompt": prompt,
#             "stream": False
#         },
#         timeout=300
#     )

#     if response.status_code != 200:
#         raise RuntimeError(f"Ollama API error: {response.text}")

#     data = response.json()
#     return data["response"].strip()
import os
import requests

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"

def ask_llm(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    body = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    response = requests.post(GROQ_URL, headers=headers, json=body, timeout=30)

    if response.status_code != 200:
        raise RuntimeError(f"Groq error: {response.text}")

    return response.json()["choices"][0]["message"]["content"].strip()