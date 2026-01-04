// src/ui/MapCalibrationUI.jsx
import React, { useState, useRef } from "react";
import { getMapCalibration, setMapCalibration } from "../core/mapCalibration";

export default function MapCalibrationUI({ currentMapUrl, onClose, canvasRef, cam, size }) {
    const [step, setStep] = useState(0); // 0=attente, 1-4=cliquer sur coin 1-4
    const [clickedPoints, setClickedPoints] = useState([]); // [{ pixelX, pixelY, q, r }, ...]
    const [tempQ, setTempQ] = useState("");
    const [tempR, setTempR] = useState("");
    const calibrationRef = useRef(null);

    const cornerNames = ["Haut-Gauche 🔺", "Haut-Droit 🔺", "Bas-Gauche 🔻", "Bas-Droit 🔻"];
    const currentCorner = cornerNames[step - 1] || "";

    if (!currentMapUrl) {
        return (
            <div style={styles.panel}>
                <h2>❌ Aucune map chargée</h2>
                <button onClick={onClose} style={styles.btn}>Fermer</button>
            </div>
        );
    }

    // Charger calibration existante
    const existing = getMapCalibration(currentMapUrl);
    if (existing && !calibrationRef.current) {
        calibrationRef.current = existing;
    }

    const handleCanvasClick = (e) => {
        if (step === 0) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Position du clic en screen space
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Convertir screen → world
        const worldX = (sx - size.w / 2) / cam.scale + cam.tx;
        const worldY = (sy - size.h / 2) / cam.scale + cam.ty;

        console.log(`[Calibration] Corner ${step} clicked at world (${worldX.toFixed(0)}, ${worldY.toFixed(0)})`);

        // Mémoriser la position du pixel
        setClickedPoints((prev) => [
            ...prev,
            { pixelX: worldX, pixelY: worldY, q: null, r: null }
        ]);
    };

    const handleQRSubmit = () => {
        if (!tempQ || !tempR) {
            alert("Rentre Q et R !");
            return;
        }

        const q = parseInt(tempQ);
        const r = parseInt(tempR);

        if (!Number.isFinite(q) || !Number.isFinite(r)) {
            alert("Q et R doivent être des nombres !");
            return;
        }

        // Mettre à jour le dernier point cliqué avec les coordonnées
        setClickedPoints((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                q,
                r,
            };
            return updated;
        });

        // Passer au coin suivant ou finir
        if (step < 4) {
            setStep(step + 1);
            setTempQ("");
            setTempR("");
        } else {
            // Tous les 4 coins sont calibrés
            finishCalibration([
                ...clickedPoints.slice(0, -1),
                { ...clickedPoints[clickedPoints.length - 1], q, r }
            ]);
        }
    };

    const finishCalibration = (points) => {
        if (points.length !== 4) {
            alert("Il faut 4 points !");
            return;
        }

        const calibration = {
            mapUrl: currentMapUrl,
            points: [
                { name: "topLeft", q: points[0].q, r: points[0].r, pixelX: points[0].pixelX, pixelY: points[0].pixelY },
                { name: "topRight", q: points[1].q, r: points[1].r, pixelX: points[1].pixelX, pixelY: points[1].pixelY },
                { name: "bottomLeft", q: points[2].q, r: points[2].r, pixelX: points[2].pixelX, pixelY: points[2].pixelY },
                { name: "bottomRight", q: points[3].q, r: points[3].r, pixelX: points[3].pixelX, pixelY: points[3].pixelY },
            ],
        };

        console.log("[Calibration] Saving:", calibration);
        setMapCalibration(currentMapUrl, calibration);
        alert("✅ Calibration sauvegardée !");

        // Reset
        setStep(0);
        setClickedPoints([]);
        setTempQ("");
        setTempR("");
        onClose();
    };

    const handleCancel = () => {
        setStep(0);
        setClickedPoints([]);
        setTempQ("");
        setTempR("");
        onClose();
    };

    return (
        <>
            {/* Overlay transparent sur le canvas pour détecter les clics */}
            {step > 0 && (
                <div
                    onClick={handleCanvasClick}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9990,
                        cursor: "crosshair",
                        background: "rgba(0, 0, 0, 0.2)",
                        pointerEvents: "auto",
                    }}
                >
                    {/* Afficher les points déjà cliqués */}
                    {clickedPoints.map((p, i) => (
                        <div
                            key={i}
                            style={{
                                position: "absolute",
                                left: `calc(50% + ${(p.pixelX - cam.tx) * cam.scale}px)`,
                                top: `calc(50% + ${(p.pixelY - cam.ty) * cam.scale}px)`,
                                width: 24,
                                height: 24,
                                marginLeft: -12,
                                marginTop: -12,
                                border: i < step - 1 ? "3px solid #0f0" : "3px solid #ff0",
                                borderRadius: "50%",
                                background: i < step - 1 ? "rgba(0,255,0,0.1)" : "rgba(255,255,0,0.1)",
                                pointerEvents: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                color: "#fff",
                                fontWeight: "bold",
                            }}
                        >
                            {i + 1}
                        </div>
                    ))}
                </div>
            )}

            {/* Panneau en haut à droite, par-dessus tout */}
            <div style={styles.panel}>
                {step === 0 && (
                    <div>
                        <h2>📐 Calibrer</h2>
                        <p style={{ lineHeight: 1.6, fontSize: 12 }}>
                            Clique sur les <strong>4 coins de l'image</strong> et rentre leur Q/R
                        </p>
                        <ul style={{ fontSize: 11, lineHeight: 1.6, paddingLeft: 15 }}>
                            <li>🔺 Haut-gauche</li>
                            <li>🔺 Haut-droit</li>
                            <li>🔻 Bas-gauche</li>
                            <li>🔻 Bas-droit</li>
                        </ul>
                        <button
                            onClick={() => setStep(1)}
                            style={{ ...styles.btn, background: "#0f0", color: "#000", marginTop: 15 }}
                        >
                            ▶️ GO
                        </button>
                    </div>
                )}

                {step > 0 && step <= 4 && (
                    <div>
                        <h2 style={{ fontSize: 14, marginBottom: 10 }}>
                            Coin {step}/4 {currentCorner}
                        </h2>
                        <p style={{ color: "#0f0", fontWeight: "bold", fontSize: 11, marginBottom: 15 }}>
                            ➡️ Clique sur la map
                        </p>

                        {clickedPoints.length >= step ? (
                            <div style={{ background: "#111", padding: 12, borderRadius: 6, marginBottom: 15, border: "1px solid #0f0" }}>
                                <p style={{ fontSize: 10 }}>✅ Cliqué à ({clickedPoints[step - 1].pixelX.toFixed(0)}, {clickedPoints[step - 1].pixelY.toFixed(0)})</p>

                                <div style={styles.inputGroup}>
                                    <label style={{ fontSize: 11 }}>Q :</label>
                                    <input
                                        type="number"
                                        value={tempQ}
                                        onChange={(e) => setTempQ(e.target.value)}
                                        placeholder="0"
                                        style={styles.input}
                                        autoFocus
                                    />
                                    <label style={{ fontSize: 11 }}>R :</label>
                                    <input
                                        type="number"
                                        value={tempR}
                                        onChange={(e) => setTempR(e.target.value)}
                                        placeholder="0"
                                        style={styles.input}
                                        onKeyPress={(e) => e.key === "Enter" && handleQRSubmit()}
                                    />
                                </div>

                                <button
                                    onClick={handleQRSubmit}
                                    style={{ ...styles.btn, background: "#0f0", color: "#000", marginTop: 10, fontSize: 11 }}
                                >
                                    ✓ Valider
                                </button>
                            </div>
                        ) : (
                            <p style={{ color: "#ff0", fontSize: 11 }}>⏳ En attente...</p>
                        )}

                        <div style={{ marginTop: 10, fontSize: 10, color: "#888" }}>
                            {Math.min(clickedPoints.length, step - 1)}/4 calibrés
                        </div>
                    </div>
                )}

                <button
                    onClick={handleCancel}
                    style={{ ...styles.btn, background: "#666", marginTop: 15, fontSize: 11 }}
                >
                    ✖ Fermer
                </button>
            </div>
        </>
    );
}

const styles = {
    panel: {
        position: "fixed",
        top: "15px",
        right: "15px",
        width: 260,
        background: "#1a1a1a",
        color: "#fff",
        padding: "15px",
        borderRadius: 10,
        border: "2px solid #0f0",
        fontFamily: "monospace",
        fontSize: 12,
        zIndex: 10000,
        boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
        maxHeight: "90vh",
        overflow: "auto",
    },
    inputGroup: {
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 6,
        alignItems: "center",
    },
    input: {
        padding: "4px 6px",
        background: "#111",
        color: "#0f0",
        border: "1px solid #0f0",
        borderRadius: 3,
        fontFamily: "monospace",
        fontSize: 11,
    },
    btn: {
        padding: "8px 12px",
        borderRadius: 4,
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
        width: "100%",
    },
};