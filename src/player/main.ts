import './player.css';
import { BRAND } from '../brand';
import type { GameProject } from '../format/types';
import { startAds, type Ads } from '../runtime/ads';
import { loadFonts } from '../runtime/fonts';
import { Game } from '../runtime/Game';
import { buildExample } from '../templates';

declare global {
  interface Window {
    /** Set by the export server (and by tests) to play a game other than a built-in starter. */
    __GAME_PROJECT__?: GameProject;
    /** Set to false by the export server for games that should not carry the "Made with" note. */
    __WATERMARK__?: boolean;
    /** false keeps every effect however slow the game runs. */
    __LIGHTEN__?: boolean;
    /** false keeps the design's shape, with strips beside it, on a screen of another shape (the tests use this). */
    __FILL__?: boolean;
    __game?: Game;
    /** The game being played, so tests can hand an example to the editor. */
    __project?: GameProject;
  }
}

async function main(): Promise<void> {
  const mount = document.getElementById('game')!;
  try {
    await loadFonts();
    // With no game supplied, an example plays; ?template=catch picks which, for development and tests.
    const example = new URLSearchParams(location.search).get('template') ?? 'runner';
    const project = window.__GAME_PROJECT__ ?? buildExample(example);
    window.__project = project;
    document.title = project.meta.name;

    // The game starts at once; ads join when (and if) they finish loading.
    let ads: Ads = { showInterstitial: () => {}, showRewarded: () => Promise.resolve(false) };
    window.__game = await Game.create(project, mount, {
      // The tests turn this off: headless Chrome is slow, and they check the full look.
      lighten: window.__LIGHTEN__ !== false,
      // A phone taller or wider than the game is filled to its edges, with no strips.
      fill: window.__FILL__ !== false,
      onShowAd: () => ads.showInterstitial(),
      onShowRewardedAd: () => ads.showRewarded(),
    });
    void startAds(project.ads).then((started) => (ads = started));

    if (window.__GAME_PROJECT__ && window.__WATERMARK__ !== false) showWatermark();
  } catch (error) {
    const box = document.createElement('div');
    box.className = 'load-error';
    box.dir = 'auto';
    box.textContent = error instanceof Error ? error.message : String(error);
    mount.replaceChildren(box);
  }
}

/** A small note in the corner for the first seconds of an exported game. */
function showWatermark(): void {
  const note = document.createElement('div');
  note.className = 'watermark';
  note.textContent = `Made with ${BRAND.en}`;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 5000);
}

void main();
