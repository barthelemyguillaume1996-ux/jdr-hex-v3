import React, { useEffect } from "react";

export default function Modal({ open, title, children, onClose, footer }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div style={styles.backdrop} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button onClick={onClose} style={styles.closeBtn} aria-label="Fermer">×</button>
                </div>
                <div style={styles.body}>{children}</div>
                {footer && <div style={styles.footer}>{footer}</div>}
            </div>
        </div>
    );
}

const styles = {
    backdrop: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "grid", placeItems: "center", zIndex: 50
    },
    modal: {
        width: "min(92vw, 520px)", background: "#1b1b1b", color: "#fff",
        borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", overflow: "hidden"
    },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2b2b2b" },
    body: { padding: 16, display: "grid", gap: 12 },
    footer: { padding: 12, borderTop: "1px solid #2b2b2b", display: "flex", gap: 8, justifyContent: "flex-end" },
    closeBtn: { background: "transparent", border: "none", color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer" }
};
