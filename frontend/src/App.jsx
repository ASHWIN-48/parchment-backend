/**
 * PARCHMENT — Document Intelligence
 * Aesthetic: Luxury editorial newspaper × deep-space terminal
 * Fonts: Bebas Neue (display) · Tenor Sans (body) · Space Mono (code)
 * Palette: #0a0a0b (void) · #f0ead6 (parchment) · #c8a96e (gilt) · #1a1a20 (panel)
 * Three.js: Slow organic ink-nebula particle cloud
 */

import {
  useState, useEffect, useRef, useCallback,
  Suspense, useMemo,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  uploadPDF, askQuestion, getDocuments, deleteDocument,
} from "./api/client";

function getSessionId() {
  let sessionId = localStorage.getItem("parchment_session");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("parchment_session", sessionId);
  }

  return sessionId;
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function clean(s) {
  if (!s) return "Untitled";
  return s.replace(/^[a-f0-9\-]{36}__\d+\.\s*/i, "").replace(/\.pdf$/i, "");
}

/* ═══════════════════════════════════════════
   THREE.JS — INK NEBULA
   800 particles in two slow counter-rotating
   clouds; golden tint, near-transparent
═══════════════════════════════════════════ */
function InkNebula() {
  const cloudA = useRef();
  const cloudB = useRef();

  const makeCloud = (n, spread, z) =>
    useMemo(() => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // gaussian-ish cluster
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = Math.pow(Math.random(), 0.5) * spread;
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
        pos[i * 3 + 2] = r * Math.cos(phi) + z;
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return g;
    }, []);

  const geoA = makeCloud(600, 9, -4);
  const geoB = makeCloud(400, 7, -8);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cloudA.current.rotation.y = t * 0.028;
    cloudA.current.rotation.x = t * 0.009;
    cloudB.current.rotation.y = -t * 0.018;
    cloudB.current.rotation.z =  t * 0.007;
  });

  return (
    <>
      <points ref={cloudA} geometry={geoA}>
        <pointsMaterial
          size={0.055} color="#c8a96e"
          transparent opacity={0.28} sizeAttenuation
        />
      </points>
      <points ref={cloudB} geometry={geoB}>
        <pointsMaterial
          size={0.04} color="#f0ead6"
          transparent opacity={0.12} sizeAttenuation
        />
      </points>
    </>
  );
}

function ThreeBG() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    }}>
      <Canvas
        camera={{ position: [0, 0, 14], fov: 50 }}
        gl={{ antialias: false, alpha: true }}
      >
        <Suspense fallback={null}>
          <InkNebula />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONFIDENCE GAUGE — segmented arc
═══════════════════════════════════════════ */
function ConfGauge({ score }) {
  const pct = Math.min(Math.round((score || 0) * 100), 100);
  const segs = 24;
  const lit  = Math.round((pct / 100) * segs);
  const col  = pct > 70 ? "#7ee8a2" : pct > 40 ? "#c8a96e" : "#f87171";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: segs }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: 0.03 * i, duration: 0.25 }}
            style={{
              width: 3, height: i < lit ? 14 : 8,
              borderRadius: 1,
              background: i < lit ? col : "rgba(255,255,255,0.06)",
              boxShadow: i < lit ? `0 0 6px ${col}55` : "none",
              alignSelf: "flex-end",
            }}
          />
        ))}
      </div>
      <div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 14, fontWeight: 400,
          color: col, lineHeight: 1,
          textShadow: `0 0 14px ${col}66`,
        }}>{pct}%</div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 7,
          color: "var(--muted)", letterSpacing: "2px", marginTop: 2,
        }}>CONFIDENCE</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TOKEN STRIP
═══════════════════════════════════════════ */
function TokenStrip({ tokens }) {
  if (!tokens) return null;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {[
        ["↑", tokens.prompt,     "#60a5fa"],
        ["↓", tokens.completion, "#7ee8a2"],
        ["Σ", tokens.total,      "rgba(255,255,255,0.22)"],
      ].map(([sym, v, c]) => (
        <span key={sym} style={{
          fontFamily: "var(--mono)", fontSize: 9,
          color: c, padding: "2px 7px",
          border: `1px solid ${c}22`,
          borderRadius: 3,
          background: `${c}08`,
        }}>{sym} {v}</span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SOURCE ACCORDION
═══════════════════════════════════════════ */
function Sources({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          all: "unset", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "var(--mono)", fontSize: 8,
          color: "var(--muted)", letterSpacing: "2px",
        }}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          style={{ display: "inline-block", fontSize: 6 }}
        >▶</motion.span>
        {sources.length} RETRIEVED PASSAGE{sources.length !== 1 ? "S" : ""}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden", marginTop: 10 }}
          >
            {sources.map((s, i) => (
              <div key={i} style={{
                padding: "10px 14px", marginBottom: 6,
                borderLeft: "1.5px solid rgba(200,169,110,0.3)",
                background: "rgba(200,169,110,0.03)",
                fontSize: 11, color: "var(--muted)",
                lineHeight: 1.72, fontFamily: "var(--mono)",
              }}>
                <div style={{
                  fontSize: 7.5, color: "rgba(200,169,110,0.45)",
                  letterSpacing: "2px", marginBottom: 5,
                }}>§ {String(i + 1).padStart(2, "0")}</div>
                {s}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DROP ZONE
═══════════════════════════════════════════ */
function DropZone({ onFile, busy, slim }) {
  const [over, setOver] = useState(false);
  const inp = useRef();

  const drop = useCallback(e => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onFile(f);
  }, [onFile]);

  return (
    <motion.div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      onClick={() => !busy && inp.current.click()}
      animate={{
        borderColor: over
          ? "rgba(200,169,110,0.6)"
          : "rgba(255,255,255,0.08)",
        background: over
          ? "rgba(200,169,110,0.04)"
          : "transparent",
      }}
      style={{
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: slim ? 6 : 12,
        padding: slim ? "14px 10px" : "52px 28px",
        textAlign: "center",
        cursor: busy ? "wait" : "pointer",
        transition: "all .2s",
      }}
    >
      {busy ? (
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            style={{
              width: 13, height: 13, borderRadius: "50%",
              border: "1.5px solid rgba(200,169,110,0.15)",
              borderTop: "1.5px solid #c8a96e",
            }}
          />
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9,
            color: "#c8a96e", letterSpacing: "2.5px",
          }}>VECTORISING</span>
        </div>
      ) : (
        <>
          <div style={{
            fontFamily: "var(--display)", fontSize: slim ? 20 : 36,
            color: "rgba(200,169,110,0.2)", marginBottom: 8, lineHeight: 1,
          }}>
            {slim ? "PDF" : "DROP\nPDF"}
          </div>
          <div style={{
            fontFamily: "var(--mono)", fontSize: slim ? 9 : 11,
            color: "var(--muted)", letterSpacing: slim ? "1px" : "1.5px",
          }}>
            {slim ? "CLICK OR DROP" : "OR CLICK TO BROWSE · PDF · MAX 50 MB"}
          </div>
        </>
      )}
      <input
        ref={inp} type="file" accept="application/pdf"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files[0]; if (f) onFile(f); }}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   SIDEBAR DOC ROW
═══════════════════════════════════════════ */
function DocRow({ doc, active, onClick, onDel }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", marginBottom: 1,
        cursor: "pointer", borderRadius: 6,
        background: active
          ? "rgba(200,169,110,0.09)"
          : hov ? "rgba(255,255,255,0.03)" : "transparent",
        border: `1px solid ${active ? "rgba(200,169,110,0.2)" : "transparent"}`,
        transition: "all .12s",
      }}
    >
      {/* edition number aesthetic */}
      <div style={{
        width: 28, height: 28, borderRadius: 5, flexShrink: 0,
        background: active
          ? "rgba(200,169,110,0.12)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(200,169,110,0.18)" : "transparent"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--mono)", fontSize: 7.5,
        color: active ? "#c8a96e" : "var(--muted)",
        letterSpacing: "0.5px",
      }}>PDF</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: active ? "var(--parchment)" : "rgba(240,234,214,0.82)",
          fontFamily: "var(--body)",
          letterSpacing: "0.2px",
        }}>{clean(doc.filename)}</div>
        <div style={{
          display: "flex", gap: 5, marginTop: 2, alignItems: "center",
        }}>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 7.5, color: "var(--muted)",
          }}>{doc.chunk_count || 0} ch</span>
          <span style={{ color: "var(--muted)", fontSize: 7 }}>·</span>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 7.5,
            color: doc.status === "ready" ? "#7ee8a2" : "#c8a96e",
          }}>{doc.status}</span>
        </div>
      </div>

      <AnimatePresence>
        {hov && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            onClick={e => { e.stopPropagation(); onDel(doc._id); }}
            style={{
              all: "unset", cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: 8,
              color: "rgba(248,113,113,0.55)",
              border: "1px solid rgba(248,113,113,0.15)",
              borderRadius: 3, padding: "2px 5px",
            }}
          >✕</motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   EMPTY STATE — editorial masthead style
   Chips fire REAL queries instantly
═══════════════════════════════════════════ */
const CHIPS = [
  "Type the definition you want explained",
  "Ask about a specific keyword or concept",
  "Mention the exact topic you want to understand",
  "Ask about a technical term from the document",
  "Type a concept name to get an explanation",
  "Ask questions using important words from the PDF"
];


function Masthead({ docName, onAsk }) {
  /* animated rule line */
  const [rulerW, setRulerW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRulerW(100), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Masthead block */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 42 }}>
        {/* Top rule */}
        <div style={{
          height: 2, background: "var(--gilt)",
          width: `${rulerW}%`,
          transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
          marginBottom: 12,
        }} />

        <div style={{
          display: "flex", alignItems: "baseline",
          justifyContent: "space-between", marginBottom: 8,
        }}>
          <div style={{
            fontFamily: "var(--mono)", fontSize: 7.5,
            color: "var(--muted)", letterSpacing: "2.5px",
          }}>DOCUMENT LOADED</div>
          <div style={{
            fontFamily: "var(--mono)", fontSize: 7.5,
            color: "var(--muted)", letterSpacing: "2px",
          }}>SEMANTIC RETRIEVAL ACTIVE</div>
        </div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 400, letterSpacing: "1px",
            color: "var(--parchment)", lineHeight: 1.05,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          {clean(docName)}
        </motion.h1>

        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
        }}>
          {/* pulse dot */}
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "#7ee8a2",
              boxShadow: "0 0 8px #7ee8a255",
            }}
          />
          <span style={{
            fontFamily: "var(--mono)", fontSize: 8,
            color: "#7ee8a2", letterSpacing: "2px",
          }}>READY FOR QUERY</span>
        </div>

        {/* Bottom rule */}
        <div style={{
          height: 1, background: "rgba(200,169,110,0.2)",
          width: `${rulerW}%`,
          transition: "width 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s",
        }} />
      </div>

      {/* Section label */}
      <div style={{
        fontFamily: "var(--mono)", fontSize: 7.5,
        color: "var(--muted)", letterSpacing: "3px",
        marginBottom: 14, alignSelf: "flex-start",
        maxWidth: 560, width: "100%",
      }}>HOW TO ASK</div>

      {/* Chips — each fires a real query */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 7,
        maxWidth: 560, width: "100%",
      }}>
        {CHIPS.map((c, i) => (
          <motion.div
            key={c}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.05, duration: 0.35 }}
        
            style={{
              cursor: "default",
              fontFamily: "var(--mono)", fontSize: 10.5,
              color: "rgba(240,234,214,0.72)",
              padding: "7px 14px",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 3,
              background: "rgba(255,255,255,0.015)",
              transition: "all .14s",
              letterSpacing: "0.3px",
            }}
          >{c}</motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   THINKING — telegraph ticker
═══════════════════════════════════════════ */
const TICKER = ["RETRIEVING PASSAGES", "RERANKING RESULTS", "GENERATING RESPONSE"];
function Thinking() {
  const [t, setT] = useState(0);
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => setT(x => (x + 1) % TICKER.length), 950);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, paddingLeft: 2 }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 5, flexShrink: 0,
        background: "rgba(200,169,110,0.12)",
        border: "1px solid rgba(200,169,110,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--display)", fontSize: 13, color: "#c8a96e",
        letterSpacing: "1px",
      }}>P</div>

      <div style={{
        padding: "9px 16px",
        background: "rgba(8,8,12,0.7)",
        border: "1px solid rgba(200,169,110,0.1)",
        borderRadius: "3px 10px 10px 10px",
        backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {/* telegraph dash animation */}
        <div style={{ display: "flex", gap: 2 }}>
          {[14, 6, 10, 6, 14].map((h, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 1.1, delay: i * 0.1, repeat: Infinity }}
              style={{
                width: h, height: 2, borderRadius: 1,
                background: "#c8a96e",
              }}
            />
          ))}
        </div>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 9,
          color: "rgba(200,169,110,0.65)", letterSpacing: "1.5px",
          minWidth: 200,
        }}>
          {TICKER[t]}{dots}
        </span>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   CHAT BUBBLES
═══════════════════════════════════════════ */
function Bubble({ item }) {
  if (item.role === "user") return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}
    >
      <div style={{
        maxWidth: "64%",
        padding: "12px 18px",
        background: "rgba(200,169,110,0.1)",
        border: "1px solid rgba(200,169,110,0.22)",
        borderRadius: "14px 14px 3px 14px",
        fontSize: 13.5, lineHeight: 1.75,
        color: "var(--parchment)",
        fontFamily: "var(--body)",
        letterSpacing: "0.2px",
      }}>{item.text}</div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 22 }}
    >
      {/* Avatar — editorial V */}
      <div style={{
        width: 30, height: 30, borderRadius: 5, flexShrink: 0, marginTop: 2,
        background: "rgba(200,169,110,0.12)",
        border: "1px solid rgba(200,169,110,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--display)", fontSize: 13, color: "#c8a96e",
      }}>P</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Answer card */}
        <div style={{
          padding: "18px 22px",
          background: "rgba(8,8,14,0.75)",
          border: "1px solid rgba(255,255,255,0.055)",
          borderRadius: "3px 16px 16px 16px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.45)",
        }}>
          {/* top rule */}
          <div style={{
            height: 1, background: "rgba(200,169,110,0.12)",
            marginBottom: 14,
          }} />

          <div className="prose">
            <ReactMarkdown>{item.data.answer}</ReactMarkdown>
          </div>

          {item.data.confidence > 0 && (
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center",
              justifyContent: "space-between", flexWrap: "wrap", gap: 10,
            }}>
              <ConfGauge score={item.data.confidence} />
              <TokenStrip tokens={item.data.tokens_used} />
            </div>
          )}

          <Sources sources={item.data.sources} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   LANDING (no doc)
═══════════════════════════════════════════ */
function Landing({ onFile, busy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flex: 1, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        textAlign: "center", maxWidth: 480,
        padding: "0 32px",
      }}>
        {/* Double rule */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 3,
          alignItems: "center", marginBottom: 28,
        }}>
          <div style={{ width: 64, height: 2, background: "var(--gilt)" }} />
          <div style={{ width: 64, height: 1, background: "rgba(200,169,110,0.3)" }} />
        </div>

        <div style={{
          fontFamily: "var(--display)",
          fontSize: "clamp(52px, 8vw, 80px)",
          fontWeight: 400, lineHeight: 0.9,
          letterSpacing: "4px",
          color: "var(--parchment)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}>Parchment</div>

        <div style={{
          fontFamily: "var(--mono)", fontSize: 8.5,
          color: "var(--gilt)", letterSpacing: "4px",
          marginBottom: 26, textTransform: "uppercase",
        }}>Document Intelligence</div>

        <div style={{
          width: 48, height: 1,
          background: "rgba(200,169,110,0.25)",
          margin: "0 auto 24px",
        }} />

        <p style={{
          fontSize: 13, color: "var(--muted)",
          lineHeight: 1.85, marginBottom: 36,
          fontFamily: "var(--body)", letterSpacing: "0.3px",
        }}>
          Upload a PDF document. Query it in natural language.
          Get precise, grounded answers using FAISS semantic
          search and Groq inference — no hallucination.
        </p>

        <DropZone onFile={onFile} busy={busy} />

        <div style={{
          marginTop: 28, display: "flex",
          justifyContent: "center", gap: 22,
        }}>
          {["FAISS", "GROQ", "RAG"].map(t => (
            <span key={t} style={{
              fontFamily: "var(--mono)", fontSize: 7.5,
              color: "rgba(200,169,110,0.3)", letterSpacing: "2px",
            }}>{t}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════ */
export default function App() {
  const [docs,     setDocs]     = useState([]);
  const [active,   setActive]   = useState(null);
  const [hist,     setHist]     = useState([]);
  const [q,        setQ]        = useState("");
  const [busy,     setBusy]     = useState(false);   // uploading
  const [upMsg,    setUpMsg]    = useState("");
  const [asking,   setAsking]   = useState(false);
  const [showUp,   setShowUp]   = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const endRef = useRef();
  const taRef  = useRef();

  useEffect(() => {
    getDocuments(sessionId)
      .then(d => {
        setDocs(d);
        if (d.length) setActive(d[0]);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [hist, asking]);

  async function handleFile(file) {
    setBusy(true); setUpMsg("Uploading…");
    try {
      const res = await uploadPDF(file, getSessionId())
      setUpMsg("Vectorising…");
      await new Promise(r => setTimeout(r, 400));
      const fresh = await getDocuments(sessionId);
      setDocs(fresh);
      setActive(fresh.find(d => d._id === res.document_id) || fresh[0]);
      setHist([]); setShowUp(false); setUpMsg("");
    } catch {
      setUpMsg("Upload failed.");
      setTimeout(() => setUpMsg(""), 2500);
    } finally { setBusy(false); }
  }

  async function send(text) {
    const query = (text ?? q).trim();
    if (!query || asking) return;
    setQ(""); setAsking(true);
    if (taRef.current) taRef.current.style.height = "auto";
    setHist(h => [...h, { role: "user", text: query }]);
    try {
      const res = await askQuestion(query, sessionId)
      setHist(h => [...h, { role: "assistant", data: res }]);
    } catch {
      setHist(h => [...h, {
        role: "assistant",
        data: { answer: "⚠ Backend unreachable.", confidence: 0, sources: [] },
      }]);
    } finally { setAsking(false); }
  }

  async function del(id) {
    await deleteDocument(id, getSessionId()).catch(() => {});
    const fresh = await getDocuments(sessionId)
    setDocs(fresh);
    if (active?._id === id) { setActive(fresh[0] || null); setHist([]); }
  }

  function resize(e) {
    setQ(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 114) + "px";
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Tenor+Sans&family=Space+Mono:wght@400;700&display=swap');

        :root {
          --bg:      #0a0a0b;
          --panel:   rgba(10,10,14,0.94);
          --surface: rgba(10,10,16,0.78);
          --border:  rgba(255,255,255,0.055);
          --gilt:    #c8a96e;
          --parchment:  #f0ead6;
          --muted:   rgba(240,234,214,0.55);
          --display: 'Bebas Neue', sans-serif;
          --body:    'Tenor Sans', serif;
          --mono:    'Space Mono', monospace;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }

        body {
          background: var(--bg);
          color: var(--parchment);
          font-family: var(--body);
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* Subtle grain */
        body::after {
          content: '';
          position: fixed; inset: 0;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          pointer-events: none; z-index: 1; opacity: 0.5;
        }

        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(200,169,110,0.15); }
        textarea, input { outline: none; }
        textarea { resize: none; overflow: hidden; }
        button { font-family: var(--mono); }

        /* ── PROSE (markdown) ── */
        .prose { font-size: 13.5px; line-height: 1.9; color: var(--parchment); font-family: var(--body); }
        .prose p { margin-bottom: 11px; }
        .prose p:last-child { margin-bottom: 0; }
        .prose ul, .prose ol { padding-left: 18px; margin-bottom: 11px; }
        .prose li { margin-bottom: 5px; }
        .prose strong { color: #e8cf9a; font-weight: 700; }
        .prose em { color: #c8a96e; }
        .prose code {
          font-family: var(--mono); font-size: 11px;
          background: rgba(200,169,110,0.07);
          border: 1px solid rgba(200,169,110,0.12);
          padding: 1px 5px; border-radius: 2px;
        }
        .prose pre {
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 14px 16px; border-radius: 6px;
          overflow-x: auto; margin-bottom: 12px;
        }
        .prose pre code { background: none; border: none; padding: 0; }
        .prose blockquote {
          border-left: 2px solid rgba(200,169,110,0.4);
          padding-left: 14px; color: var(--muted);
          margin: 8px 0; font-style: italic;
        }
        .prose h1, .prose h2, .prose h3 {
          font-family: var(--display);
          font-weight: 400; margin: 18px 0 8px;
          color: var(--gilt); letter-spacing: "1px";
          text-transform: uppercase;
        }
        .prose h1 { font-size: 26px; }
        .prose h2 { font-size: 20px; }
        .prose h3 { font-size: 16px; }
        .prose table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .prose th, .prose td { border: 1px solid rgba(255,255,255,0.06); padding: 7px 11px; font-size: 12px; }
        .prose th { background: rgba(200,169,110,0.06); color: var(--gilt); font-family: var(--mono); font-size: 8px; letter-spacing: 2px; text-transform: uppercase; }
        .prose a { color: var(--gilt); }
        .prose hr { border: none; border-top: 1px solid rgba(200,169,110,0.18); margin: 14px 0; }
      `}</style>

      {/* Three.js nebula */}
      <ThreeBG />

      {/* App shell */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", height: "100vh", overflow: "hidden",
      }}>

        {/* ══════════ SIDEBAR ══════════ */}
        <AnimatePresence initial={false}>
          {sideOpen && (
            <motion.aside
              key="aside"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 236, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                flexShrink: 0, overflow: "hidden",
                background: "rgba(8,8,13,0.95)",
                borderRight: "1px solid var(--border)",
                backdropFilter: "blur(28px)",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{ width: 236, height: "100%", display: "flex", flexDirection: "column" }}>

                {/* ── Brand ── */}
                <div style={{
                  padding: "20px 16px 16px",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {/* double rule */}
                  <div style={{
                    display: "flex", flexDirection: "column", gap: 2, marginBottom: 12,
                  }}>
                    <div style={{ height: 2, background: "var(--gilt)" }} />
                    <div style={{ height: 1, background: "rgba(200,169,110,0.2)" }} />
                  </div>

                  <div style={{
                    fontFamily: "var(--display)",
                    fontSize: 28, color: "var(--parchment)",
                    letterSpacing: "3px", lineHeight: 1,
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}>Parchment</div>

                  <div style={{
                    fontFamily: "var(--mono)", fontSize: 6.5,
                    color: "rgba(200,169,110,0.45)",
                    letterSpacing: "2.5px", textTransform: "uppercase",
                  }}>Document Intelligence</div>

                  <div style={{
                    height: 1, background: "rgba(200,169,110,0.15)",
                    marginTop: 12,
                  }} />
                </div>

                {/* ── Corpus label ── */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 16px 7px",
                }}>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 7.5,
                    color: "var(--muted)", letterSpacing: "2px",
                  }}>CORPUS</span>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 7.5,
                    color: "rgba(200,169,110,0.5)",
                    background: "rgba(200,169,110,0.07)",
                    border: "1px solid rgba(200,169,110,0.12)",
                    padding: "1px 7px", borderRadius: 3,
                  }}>{docs.length}</span>
                </div>

                {/* ── Doc list ── */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
                  {docs.length === 0 && (
                    <div style={{
                      padding: "24px 8px", textAlign: "center",
                      fontFamily: "var(--mono)", fontSize: 9,
                      color: "var(--muted)", letterSpacing: "1.5px",
                    }}>NO DOCUMENTS</div>
                  )}
                  <AnimatePresence>
                    {docs.map((doc, i) => (
                      <motion.div
                        key={doc._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <DocRow
                          doc={doc}
                          active={active?._id === doc._id}
                          onClick={() => { setActive(doc); setHist([]); setShowUp(false); }}
                          onDel={del}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* ── Upload ── */}
                <div style={{
                  padding: "10px 10px 16px",
                  borderTop: "1px solid var(--border)",
                }}>
                  <AnimatePresence>
                    {upMsg && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                          overflow: "hidden", marginBottom: 7,
                          padding: "6px 10px",
                          background: "rgba(200,169,110,0.06)",
                          border: "1px solid rgba(200,169,110,0.15)",
                          borderRadius: 4,
                          fontFamily: "var(--mono)", fontSize: 8.5,
                          color: "#c8a96e",
                        }}
                      >{upMsg}</motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileHover={{
                      background: "rgba(200,169,110,0.07)",
                      borderColor: "rgba(200,169,110,0.25)",
                      color: "#c8a96e",
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUp(o => !o)}
                    style={{
                      display: "block", width: "100%",
                      padding: "9px", borderRadius: 5,
                      background: showUp
                        ? "rgba(200,169,110,0.07)"
                        : "rgba(255,255,255,0.025)",
                      border: `1px solid ${showUp
                        ? "rgba(200,169,110,0.25)"
                        : "rgba(255,255,255,0.06)"}`,
                      color: showUp ? "#c8a96e" : "var(--muted)",
                      fontFamily: "var(--mono)", fontSize: 9,
                      letterSpacing: "1.5px", cursor: "pointer",
                      textTransform: "uppercase",
                      transition: "all .14s",
                    }}
                  >+ Upload PDF</motion.button>

                  <AnimatePresence>
                    {showUp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden", marginTop: 8 }}
                      >
                        <DropZone onFile={handleFile} busy={busy} slim />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ══════════ MAIN ══════════ */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", minWidth: 0,
        }}>

          {/* ── Top bar ── */}
          <div style={{
            height: 48, flexShrink: 0,
            display: "flex", alignItems: "center", gap: 11,
            padding: "0 16px",
            background: "rgba(8,8,13,0.9)",
            borderBottom: "1px solid var(--border)",
            backdropFilter: "blur(24px)",
            zIndex: 10,
          }}>
            {/* Toggle */}
            <motion.button
              whileHover={{ background: "rgba(200,169,110,0.12)", color: "#c8a96e" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSideOpen(o => !o)}
              style={{
                all: "unset", cursor: "pointer",
                width: 28, height: 28, borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)",
                flexShrink: 0, transition: "all .14s",
              }}
            >{sideOpen ? "‹" : "›"}</motion.button>

            {active ? (
              <>
                {/* gilt rule left */}
                <div style={{ width: 2, height: 24, background: "var(--gilt)", flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "var(--display)",
                    fontSize: 16, letterSpacing: "1.5px",
                    overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", color: "var(--parchment)",
                    textTransform: "uppercase",
                  }}>{clean(active.filename)}</div>
                  <div style={{
                    fontFamily: "var(--mono)", fontSize: 7.5,
                    color: "var(--muted)", letterSpacing: "1.5px", marginTop: 1,
                  }}>
                    {active.chunk_count} PASSAGES ·{" "}
                    <span style={{ color: active.status === "ready" ? "#7ee8a2" : "#c8a96e" }}>
                      {active.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* badges */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {["RAG", "FAISS", "GROQ"].map(t => (
                    <span key={t} style={{
                      fontFamily: "var(--mono)", fontSize: 7,
                      color: "rgba(200,169,110,0.4)",
                      padding: "2px 7px",
                      border: "1px solid rgba(200,169,110,0.1)",
                      borderRadius: 2,
                      background: "rgba(200,169,110,0.03)",
                      letterSpacing: "1px",
                    }}>{t}</span>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                fontFamily: "var(--mono)", fontSize: 9,
                color: "var(--muted)", letterSpacing: "1.5px",
              }}>NO DOCUMENT LOADED</div>
            )}
          </div>

          {/* ── No doc ── */}
          {!active && <Landing onFile={handleFile} busy={busy} />}

          {/* ── Chat ── */}
          {active && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px" }}>
                <div style={{ maxWidth: 740, margin: "0 auto" }}>
                  {hist.length === 0 && (
                    <Masthead docName={active.filename} onAsk={send} />
                  )}
                  {hist.map((item, i) => <Bubble key={i} item={item} />)}
                  {asking && <Thinking />}
                  <div ref={endRef} />
                </div>
              </div>

              {/* ── Input ── */}
              <div style={{
                flexShrink: 0,
                padding: "12px 20px 18px",
                background: "rgba(8,8,13,0.95)",
                borderTop: "1px solid var(--border)",
                backdropFilter: "blur(24px)",
              }}>
                {/* top gilt rule */}
                <div style={{
                  maxWidth: 740, margin: "0 auto 10px",
                  height: 1, background: "rgba(200,169,110,0.1)",
                }} />

                <div style={{ maxWidth: 740, margin: "0 auto" }}>
                  <div
                    id="input-wrap"
                    style={{
                      display: "flex", gap: 8, alignItems: "flex-end",
                      background: "rgba(14,14,20,0.88)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "9px 11px",
                      transition: "border-color .18s, box-shadow .18s",
                    }}
                    onFocusCapture={e => {
                      e.currentTarget.style.borderColor = "rgba(200,169,110,0.3)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,169,110,0.05)";
                    }}
                    onBlurCapture={e => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <textarea
                      ref={taRef}
                      value={q}
                      onChange={resize}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault(); send();
                        }
                      }}
                      placeholder="Query the document…"
                      rows={1}
                      style={{
                        flex: 1, background: "none", border: "none",
                        color: "var(--parchment)", fontSize: 13.5, lineHeight: 1.65,
                        minHeight: 22, maxHeight: 114,
                        fontFamily: "var(--body)", letterSpacing: "0.2px",
                      }}
                    />

                    <motion.button
                      whileHover={{ scale: asking || !q.trim() ? 1 : 1.06 }}
                      whileTap={{ scale: asking || !q.trim() ? 1 : 0.94 }}
                      onClick={() => send()}
                      disabled={asking || !q.trim()}
                      style={{
                        all: "unset", cursor: asking || !q.trim() ? "not-allowed" : "pointer",
                        padding: "7px 18px", borderRadius: 5,
                        flexShrink: 0, alignSelf: "flex-end",
                        background: asking || !q.trim()
                          ? "rgba(255,255,255,0.04)"
                          : "linear-gradient(135deg, #c8a96e, #a07d42)",
                        color: asking || !q.trim() ? "var(--muted)" : "#0a0a0b",
                        fontFamily: "var(--mono)", fontSize: 9.5,
                        letterSpacing: "2px", textTransform: "uppercase",
                        boxShadow: asking || !q.trim()
                          ? "none"
                          : "0 0 24px rgba(200,169,110,0.28)",
                        transition: "background .18s, box-shadow .18s",
                      }}
                    >
                      {asking ? (
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.1, repeat: Infinity }}
                        >···</motion.span>
                      ) : "Send"}
                    </motion.button>
                  </div>

                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    marginTop: 6, padding: "0 2px",
                  }}>
                    <span style={{
                      fontFamily: "var(--mono)", fontSize: 7.5,
                      color: "rgba(240,234,214,0.1)", letterSpacing: "0.5px",
                    }}>ENTER TO SEND · SHIFT+ENTER FOR NEWLINE</span>

                    <AnimatePresence>
                      {asking && (
                        <motion.span
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          style={{
                            fontFamily: "var(--mono)", fontSize: 7.5,
                            color: "rgba(200,169,110,0.55)", letterSpacing: "1.5px",
                          }}
                        >● PROCESSING</motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}