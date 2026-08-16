import React, { useState, useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";

export default function TerminalLogger() {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    // The backend is hardcoded to :4000 in dev
    const eventSource = new EventSource("http://localhost:4000/api/logs");

    eventSource.onmessage = (event) => {
      try {
        const chunk = JSON.parse(event.data);
        if (!chunk) return;
        
        // Since EZKL logs might come as multiline chunks, split by newline to render cleanly
        const lines = chunk.split("\n").filter((l) => l.trim().length > 0);
        
        if (lines.length > 0) {
          setLogs((prev) => {
            // Keep last 150 lines to prevent DOM bloat
            const newLogs = [...prev, ...lines];
            return newLogs.length > 150 ? newLogs.slice(newLogs.length - 150) : newLogs;
          });
        }
      } catch (err) {
        // ignore parse errors
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} />
          <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 600 }}>LIVE COMPUTATION</span>
        </div>
        <button 
          onClick={() => setLogs([])}
          title="Clear Logs"
          className="terminal-clear"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="terminal-body">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
            Awaiting cryptographic execution...
          </div>
        ) : (
          logs.map((line, idx) => (
            <div key={idx} className="terminal-line">
              <span className="terminal-prompt">$</span> {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
