export type InteractionMode =
    | 'idle'
    | 'placing'
    | 'dragging'
    | 'selected'
    | 'editing-config'
    | 'ready-to-submit'
    | 'sim-running'
    | 'move-node';

export interface InteractionState {
    mode: InteractionMode;
    cursorGX: number;
    cursorGY: number;
    dragNodeId: string | null;
    dragKind: string | null;
    previewGX: number | null;
    previewGY: number | null;
    moveNodeId: string | null;
    moveStartGX: number | null;
    moveStartGY: number | null;
}

export function createInitialInteractionState(gx: number, gy: number): InteractionState {
    return {
        mode: 'placing',
        cursorGX: gx,
        cursorGY: gy,
        dragNodeId: null,
        dragKind: null,
        previewGX: null,
        previewGY: null,
        moveNodeId: null,
        moveStartGX: null,
        moveStartGY: null,
    };
}
