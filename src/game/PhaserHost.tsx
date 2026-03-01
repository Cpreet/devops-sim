// ── PhaserHost – mounts Phaser inside React ─────────────────────────────
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BuildScene } from './scenes/BuildScene';
import type { SimEngine } from '../sim/engine/SimEngine';
import type { SimSnapshot } from '../sim/types';
import type { RadialAction } from './render/radialMenu';

interface Props {
    engine: SimEngine;
    onSnapshot: (snap: SimSnapshot) => void;
    onRadialAction?: (action: RadialAction) => void;
    /** Incremented externally to signal "redraw everything". */
    redrawToken: number;
}

export function PhaserHost({ engine, onSnapshot, onRadialAction, redrawToken }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<BuildScene | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        const game = new Phaser.Game({
            type: Phaser.CANVAS,
            parent: containerRef.current,
            width: Math.floor(rect.width),
            height: Math.floor(rect.height),
            backgroundColor: '#0d0d1a',
            scene: [],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            input: {
                keyboard: true,
            },
            audio: {
                noAudio: true,
            },
        });

        const scene = new BuildScene();
        game.scene.add('BuildScene', scene, true, { engine, onSnapshot, onRadialAction });
        gameRef.current = game;
        sceneRef.current = scene;

        return () => {
            game.destroy(true);
            gameRef.current = null;
            sceneRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Redraw when token changes (load preset / reset)
    useEffect(() => {
        if (redrawToken > 0 && sceneRef.current) {
            if (engine.nodes.length > 0) {
                sceneRef.current.redrawNodes();
            } else {
                sceneRef.current.clearAll();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redrawToken]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden' }}
        />
    );
}
