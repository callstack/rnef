import * as path from 'node:path';
import { pluginCallstackTheme } from '@callstack/rspress-theme/plugin';
import { pluginLlms } from '@rspress/plugin-llms';
import { pluginOpenGraph } from 'rsbuild-plugin-open-graph';
import { defineConfig } from 'rspress/config';
import pluginSitemap from 'rspress-plugin-sitemap';
import vercelPluginAnalytics from 'rspress-plugin-vercel-analytics';

export default defineConfig({
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
  builderConfig: {
    plugins: [
      pluginOpenGraph({
        title: 'React Native Enterprise Framework',
        type: 'website',
        url: 'https://rnef.dev',
        image: 'https://rnef.dev/og-image.png',
        description:
          'A successor to Community CLI with focus on modularity, build reuse and incremental adoption',
        twitter: {
          site: '@rnef_dev',
          card: 'summary_large_image',
        },
      }),
    ],
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
  plugins: [
    pluginCallstackTheme(),
    // @ts-expect-error outdated @rspress/shared declared as dependency
    vercelPluginAnalytics(),
    pluginLlms({
      exclude: ({ page }) => page.routePath.includes('404'),
    }),
    pluginSitemap({ domain: 'https://rnef.dev' }),
  ],
});
