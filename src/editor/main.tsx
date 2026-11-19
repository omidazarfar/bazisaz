import '@fontsource/lalezar/arabic-400.css';
import './editor.css';
import { createRoot } from 'react-dom/client';
import { loadFonts } from '../runtime/fonts';
import { App } from './App';
import { loadSaved } from './state';

// Fonts first: the game draws its text once and would otherwise keep a fallback font.
const [saved] = await Promise.all([loadSaved(), loadFonts()]);
createRoot(document.getElementById('root')!).render(<App saved={saved} />);
