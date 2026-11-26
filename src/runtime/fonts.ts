import latinRegular from '@fontsource/fredoka/files/fredoka-latin-400-normal.woff2?url';
import latinBold from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff2?url';
import bangers from '@fontsource/bangers/files/bangers-latin-400-normal.woff2?url';
import pixel from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url';
import persianRegular from 'vazirmatn/fonts/webfonts/Vazirmatn-Regular.woff2?url';
import persianBold from 'vazirmatn/fonts/webfonts/Vazirmatn-Bold.woff2?url';
// Kenney Future (CC0, Kenney's UI Pack; CREDITS.md): the flagship's menus and titles.
import kenneyFuture from './kenney-future.ttf?url';

/** Used for any character the game's own font lacks, so Persian text typed into a game still renders well. */
export const FALLBACK_FONT = 'Vazirmatn';

/**
 * Canvas text falls back to a system font if the real one isn't ready when
 * the text is first drawn, and never redraws. So the fonts are loaded and
 * registered before any game is created.
 *
 * Fredoka, Bangers and Press Start 2P are the fonts a game can choose
 * (Latin letters and digits). Vazirmatn draws the Persian editor and backs
 * up the game font.
 */
export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace('Fredoka', `url(${latinRegular})`, { weight: '400' }),
    new FontFace('Fredoka', `url(${latinBold})`, { weight: '700' }),
    // These two come in one weight; the browser thickens them itself for bold text.
    new FontFace('Bangers', `url(${bangers})`),
    new FontFace('Press Start 2P', `url(${pixel})`),
    new FontFace('Kenney Future', `url(${kenneyFuture})`),
    new FontFace(FALLBACK_FONT, `url(${persianRegular})`, { weight: '400' }),
    new FontFace(FALLBACK_FONT, `url(${persianBold})`, { weight: '700' }),
  ];
  await Promise.all(
    faces.map(async (face) => {
      await face.load();
      document.fonts.add(face);
    }),
  );
}
