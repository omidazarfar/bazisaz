import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GameProject } from '../format/types';
import { Game, type Box, type EditView, type GameMode } from '../runtime/Game';

declare global {
  interface Window {
    __game?: Game;
  }
}

interface Props {
  project: GameProject;
  mode: GameMode;
  selected: string[];
  /** How the scene is being looked at while editing: zoom, tool and grid. */
  view: EditView;
  /** Receives the running game, so the editor can ask it where the view is. */
  api: RefObject<Game | null>;
  onPick: (id: string | null, add: boolean) => void;
  onPickMany: (ids: string[], add: boolean) => void;
  /** A drag or resize in the game has ended with objects in a new place or size. */
  onChange: (changes: { id: string; box: Box }[]) => void;
  /** The zoom was changed from inside the game, with the mouse wheel. */
  onView: (view: EditView) => void;
  /** A stroke of the paint tool has ended, with the tile map's new rows. */
  onTiles: (id: string, rows: string[]) => void;
  onShowAd: () => void;
  /** Stands in for a rewarded ad; resolves true as if the player watched it. */
  onShowRewardedAd: () => Promise<boolean>;
  /** Called with a message when the current project cannot be shown, and with null once it can. */
  onProblem: (message: string | null) => void;
}

/**
 * The live game inside the editor. One Game is created for the life of the
 * page; edits are pushed into it rather than rebuilding it, so the picture
 * updates without a flicker.
 */
export function Preview(props: Props) {
  const { project, mode, selected, view } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ready, setReady] = useState(false);

  // The game holds on to its callbacks for its whole life, so it is given
  // stable wrappers that always call the latest version.
  const latest = useRef(props);
  latest.current = props;

  // Projects are applied one after another, so a slow image load can never
  // finish after a newer edit and overwrite it.
  const pending = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    Game.create(project, mountRef.current!, {
      mode,
      onPick: (id, add) => latest.current.onPick(id, add),
      onPickMany: (ids, add) => latest.current.onPickMany(ids, add),
      onChange: (changes) => latest.current.onChange(changes),
      onView: (next) => latest.current.onView(next),
      onTiles: (id, rows) => latest.current.onTiles(id, rows),
      onShowAd: () => latest.current.onShowAd(),
      onShowRewardedAd: () => latest.current.onShowRewardedAd(),
    }).then(
      (game) => {
        if (cancelled) return game.destroy();
        gameRef.current = game;
        latest.current.api.current = game;
        window.__game = game;
        setReady(true);
      },
      (error: unknown) => latest.current.onProblem(messageOf(error)),
    );
    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
      latest.current.api.current = null;
      setReady(false);
    };
    // Created once; later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!ready || !game) return;
    pending.current = pending.current
      .then(() => game.setProject(project))
      .then(
        () => latest.current.onProblem(null),
        (error: unknown) => latest.current.onProblem(messageOf(error)),
      );
  }, [project, ready]);

  const scene = mode.scene ?? null;
  useEffect(() => {
    if (ready) gameRef.current?.setMode(mode);
    // `mode` is rebuilt on every render; its two fields are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, scene, ready]);

  const selectedKey = selected.join('|');
  useEffect(() => {
    if (ready) gameRef.current?.setSelection(selected);
    // The list is rebuilt on every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, ready]);

  useEffect(() => {
    if (ready) gameRef.current?.setView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.zoom, view.tool, view.grid, view.brush, ready]);

  return <div ref={mountRef} className="phone-screen" />;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
