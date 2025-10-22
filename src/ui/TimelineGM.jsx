import React, { useCallback } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import TimelineBar from "./TimelineBar";

export default function TimelineGM() {
    const { tokens, activeId } = useAppState();
    const dispatch = useAppDispatch();

    const onPass = useCallback(() => {
        dispatch({ type: "NEXT_TURN" });
    }, [dispatch]);

    const onPick = useCallback((id) => {
        dispatch({ type: "SET_ACTIVE", id });
    }, [dispatch]);

    return (
        <TimelineBar
            tokens={tokens}
            activeId={activeId}
            onPass={onPass}
            onPick={onPick}
            showPassButton
        />
    );
}
