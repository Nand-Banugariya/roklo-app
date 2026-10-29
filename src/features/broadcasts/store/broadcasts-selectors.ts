import { createSelector } from "@reduxjs/toolkit";
import type { BroadcastsRootState } from "./broadcasts-thunks";

const broadcasts = (state: BroadcastsRootState) => state.broadcasts;

export const selectBroadcastsList = (state: BroadcastsRootState) => state.broadcasts.list;
export const selectBroadcastCounts = (state: BroadcastsRootState) => state.broadcasts.counts;
/** The list's broadcasts, in order (one array until the list or a row changes). */
export const selectBroadcastRows = createSelector([broadcasts], (state) =>
  state.list.ids.map((id) => state.rows[id]).filter((row) => row !== undefined),
);
/** A list row by id: a broadcast's numbers as the list last read them, or null. */
export const selectBroadcastRow = (state: BroadcastsRootState, id: string) =>
  state.broadcasts.rows[id] ?? null;
export const selectBroadcastDetail = (state: BroadcastsRootState, id: string) =>
  state.broadcasts.details[id] ?? null;
export const selectRuns = (state: BroadcastsRootState) => state.broadcasts.runs;
export const selectRun = (state: BroadcastsRootState, runId: string) =>
  state.broadcasts.runs[runId] ?? null;
export const selectRunDetail = (state: BroadcastsRootState, runId: string) =>
  state.broadcasts.runDetails[runId] ?? null;
export const selectBroadcastTags = (state: BroadcastsRootState) => state.broadcasts.tags;
export const selectAudience = (state: BroadcastsRootState) => state.broadcasts.audience;
export const selectAccessTargets = (state: BroadcastsRootState) => state.broadcasts.access;
