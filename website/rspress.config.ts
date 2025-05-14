import * as path from 'node:path';
import { pluginCallstackTheme } from '@callstack/rspress-theme/plugin';
import { defineConfig } from 'rspress/config';
import vercelPluginAnalytics from 'rspress-plugin-vercel-analytics';

export default defineConfig({
  plugins: [pluginCallstackTheme(), vercelPluginAnalytics()],
  root: path.join(__dirname, 'docs'),
  title: 'React Native Enterprise Framework',
  icon: '/logo.svg',
  outDir: 'build',
  route: {
    cleanUrls: true,
  },
  logo: {
    light: '/logo.svg',
    dark: '/logo.svg',
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/callstack/rnef',
      },
    ],
    footer: {
      message:
        'Copyright © 2025 <a href="https://callstack.com">Callstack</a>.',
    },
  },
});
