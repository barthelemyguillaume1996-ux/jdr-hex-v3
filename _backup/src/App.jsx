// src/App.jsx - VERSION CORRECTE
/* eslint-disable no-empty */
import React, { Suspense, useEffect } from "react";
import { StateProvider, useAppState } from "./state/StateProvider";

import HexBoard from "./ui/HexBoard";
import LeftDrawer from "./ui/LeftDrawer";
import RightDrawer from "./ui/RightDrawer";
import TimelineBar from "./ui/TimelineBar";
import DrawingWorkspace from "./ui/DrawingWorkspace";
import CastBridge from "./ui/CastBridge";

const ViewerPage = React.lazy(() => import("./ViewerPage"));

/* ---------- ErrorBoundary ---------- */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { err: null };
    }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err, info) { console.error("[App Error]", err, info); }
    render() {
        if (this.state.err) {
            return (
                <div style={{
                    color: "#fff", background: "#111", minHeight: "100vh",
                    padding: 24, fontFamily: "ui-sans-serif, system-ui"
                }}>
                    <h2 style={{ marginTop: 0 }}>Une erreur est survenue 😵</h2>
                    <pre style={{
                        background: "#1a1a1a", border: "1px solid #2a2a2a",
                        padding: 12, borderRadius: 8, whiteSpace: "pre-wrap"
                    }}>
                        {String(this.state.err?.message || this.state.err)}
                    </pre>
                    <p>Regarde la console pour le détail.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

/* ---------- Hook : lock du scroll uniquement quand actif ---------- */
function useScrollLock(active) {
    useEffect(() => {
        if (!active) return;

        const html = document.documentElement;
        const body = document.body;

        const prev = {
            htmlOverflow: html.style.overflow,
            htmlHeight: html.style.height,
            bodyOverflow: body.style.overflow,
            bodyWidth: body.style.width,
            bodyHeight: body.style.height,
            bodyPosition: body.style.position,
            bodyInset: body.style.inset,
            bodyOverscroll: body.style.overscrollBehavior,
            touchAction: body.style.touchAction,
        };

        html.style.height = "100%";
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";
        body.style.width = "100%";
        body.style.height = "100%";
        body.style.position = "fixed";
        body.style.inset = "0";
        body.style.overscrollBehavior = "none";
        body.style.touchAction = "none";

        const isInScrollable = (el) => {
            let node = el;
            while (node && node !== body) {
                const cs = getComputedStyle(node);
                const oy = cs.overflowY;
                const canScroll = (oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight;
                if (canScroll) return true;
                node = node.parentElement;
            }
            return false;
        };

        const preventIfNotScrollable = (e) => {
            if (isInScrollable(e.target)) return;
            e.preventDefault();
        };

        window.addEventListener("touchmove", preventIfNotScrollable, { passive: false });
        window.addEventListener("wheel", preventIfNotScrollable, { passive: false });
        window.addEventListener("gesturestart", preventIfNotScrollable, { passive: false });

        return () => {
            window.removeEventListener("touchmove", preventIfNotScrollable);
            window.removeEventListener("wheel", preventIfNotScrollable);
            window.removeEventListener("gesturestart", preventIfNotScrollable);

            html.style.overflow = prev.htmlOverflow;
            html.style.height = prev.htmlHeight;
            body.style.overflow = prev.bodyOverflow;
            body.style.width = prev.bodyWidth;
            body.style.height = prev.bodyHeight;
            body.style.position = prev.bodyPosition;
            body.style.inset = prev.bodyInset;
            body.style.overscrollBehavior = prev.bodyOverscroll;
            body.style.touchAction = prev.touchAction;
        };
    }, [active]);
}

export default function App() {
    const isViewer = new URLSearchParams(window.location.search).has("viewer");

    if (isViewer) {
        return (
            <ErrorBoundary>
                <Suspense
                    fallback={
                        <div
                            style={{
                                color: "#fff",
                                background: "#111",
                                height: "100vh",
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            Chargement de la vue joueurs…
                        </div>
                    }
                >
                    <ViewerPage />
                </Suspense>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <StateProvider>
                <GMRoot />
            </StateProvider>
        </ErrorBoundary>
    );
}

function GMRoot() {
    const { drawMode } = useAppState();

    useScrollLock(!!drawMode);

    return (
        <>
            <CastBridge />
            <HexBoard fullscreen />
            <LeftDrawer />
            <RightDrawer />
            <TimelineBar />


            {/* 🔥 DrawingWorkspace SANS wrapper */}
            {drawMode && <DrawingWorkspace />}
        </>
    );
}