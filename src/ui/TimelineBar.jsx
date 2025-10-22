import React, { useMemo } from "react";

// Avatar avec support .webp/.png/.jpg/.jpeg
function Avatar({ name = "", img = "", active = false, size = 32 }) {
    const styleWrap = {
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: active ? "3px solid rgba(80,220,170,0.95)" : "2px solid rgba(255,255,255,0.8)",
        boxSizing: "border-box",
        background: "#222",
        display: "grid",
        placeItems: "center"
    };
    const styleImg = { width: "100%", height: "100%", objectFit: "cover" };

    const hasExt = /\.\w{3,4}$/.test(img);
    const isUrl = /^(blob:|data:|https?:)/.test(img);

    const initials = (name || "")
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map(s => s[0]?.toUpperCase() || "").join("");

    return (
        <div style={styleWrap} title={name}>
            {!img ? (
                <span style={{ fontSize: 12, color: "#ddd", letterSpacing: 0.3 }}>{initials || "?"}</span>
            ) : (isUrl || hasExt) ? (
                <img src={img} alt="" style={styleImg} onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : (
                <picture>
                    <source srcSet={`${img}.webp`} type="image/webp" />
                    <source srcSet={`${img}.png`} type="image/png" />
                    <source srcSet={`${img}.jpg`} type="image/jpeg" />
                    <img src={`${img}.jpeg`} alt="" style={styleImg} onError={(e) => (e.currentTarget.style.display = "none")} />
                </picture>
            )}
        </div>
    );
}

export default function TimelineBar({
    tokens = [],
    activeId = null,
    onPass = null,
    onPick = null,
    showPassButton = false
}) {
    // Tri : déployés, initiative ↓ puis nom
    const ordered = useMemo(() => {
        const arr = tokens.filter(t => !!t.isDeployed);
        arr.sort((a, b) => {
            const ia = Number.isFinite(a.initiative) ? a.initiative : 0;
            const ib = Number.isFinite(b.initiative) ? b.initiative : 0;
            if (ib !== ia) return ib - ia;
            const na = (a.name || "").toLowerCase();
            const nb = (b.name || "").toLowerCase();
            if (na !== nb) return na < nb ? -1 : 1;
            return (a.id || "").localeCompare(b.id || "");
        });
        return arr;
    }, [tokens]);

    const wrap = {
        position: "fixed",
        left: "50%",
        bottom: 8,
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "rgba(15,15,15,0.85)",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        backdropFilter: "blur(4px)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        maxWidth: "90vw",
        overflowX: "auto"
    };

    const item = {
        display: "grid",
        gap: 2,
        justifyItems: "center",
        minWidth: 42
    };
    const name = {
        maxWidth: 68,
        fontSize: 10,
        color: "#ddd",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textAlign: "center",
        marginTop: 2
    };
    const initBadge = { fontSize: 10, color: "#aaa", marginTop: 0 };
    const passBtn = {
        padding: "6px 8px",
        borderRadius: 8,
        border: "1px solid #2c4",
        background: "#18ff9b",
        color: "#000",
        fontWeight: 700,
        cursor: "pointer",
        marginLeft: 6
    };

    return (
        <div style={wrap}>
            {ordered.map((t) => {
                const isActive = t.id === activeId;
                return (
                    <button
                        key={t.id}
                        onClick={() => onPick && onPick(t.id)}
                        title={t.name || ""}
                        style={{ background: "transparent", border: "none", padding: 0, cursor: onPick ? "pointer" : "default" }}
                    >
                        <div style={item}>
                            <Avatar name={t.name} img={t.img} active={isActive} size={36} />
                            <div style={name}>{t.name || "Sans nom"}</div>
                            <div style={initBadge}>{Number.isFinite(t.initiative) ? `Init ${t.initiative}` : ""}</div>
                        </div>
                    </button>
                );
            })}
            {showPassButton && ordered.length > 0 && (
                <button onClick={() => onPass && onPass()} title="Passer le tour" style={passBtn}>→</button>
            )}
        </div>
    );
}
