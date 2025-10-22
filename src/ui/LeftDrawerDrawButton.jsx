// src/ui/LeftDrawerDrawButton.jsx
/* eslint-disable no-empty */
import React, { useEffect, useState } from "react";

export default function LeftDrawerDrawButton() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        const t = setInterval(() => {
            try { setOn(Boolean(window.__quickDrawStatus?.())); } catch { }
        }, 300);
        return () => clearInterval(t);
    }, []);

    const toggle = () => {
        try {
            const v = window.__toggleQuickDrawLive?.();
            setOn(!!v);
        } catch { }
    };

    return (
        <div style={{ padding: 8, borderBottom: "1px solid #242424" }}>
            <button
                onClick={toggle}
                title="Tracer au crayon directement sur la map (cast en direct)"
                style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: on ? "1px solid #2c4" : "1px solid #333",
                    background: on ? "#18ff9b" : "#1b1b1b",
                    color: on ? "#000" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                }}
            >
                ✏️ Crayon live {on ? "ON" : "OFF"}
            </button>
        </div>
    );
}
