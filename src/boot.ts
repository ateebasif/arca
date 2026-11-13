// Imported first by every page so the saved theme is applied before anything
// renders. Keep this file tiny and dependency-free.
import { applyCachedTheme } from './lib/theme';

applyCachedTheme();
