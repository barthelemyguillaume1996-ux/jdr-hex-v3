// src/ViewerPage.jsx
/* eslint-disable no-empty */
import React, { useEffect } from "react";
import { useCastStore } from "./cast/castClient";
import HexBoardView from "./ui/HexBoardView";
import TimelineBar from "./ui/TimelineBar";

export default function ViewerPage() {
    // Abonnement (utile si tu veux conditionner l’arrière-plan, etc.)
    const { currentMapUrl } = useCastStore();

    // Handshake : récupérer l’état si on arrive après le GM
    useEffect(() => {
        try {
            window.__castSend?.({ type: "REQUEST_SNAPSHOT" });
            setTimeout(() => window.__castSend?.({ type: "HELLO" }), 50);
        } catch { }
    }, []);

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                background: "#111",
                overflow: "hidden",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
            }}
        >
            {/* Plateau joueurs */}
            <HexBoardView fullscreen />

            {/* Timeline joueurs (utilise le même fichier src/ui/TimelineBar.jsx) */}
            <TimelineBar />
        </div>
    );
}
