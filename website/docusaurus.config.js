// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'File Mover Express',
  tagline: 'Move media to Amazon S3 at wire speed',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
    faster: true,
  },

  // Production URL for the awslabs GitHub Pages project site.
  url: 'https://awslabs.github.io',
  baseUrl: '/filemoverexpress/',

  organizationName: 'awslabs',
  projectName: 'filemoverexpress',
  trailingSlash: false,

  // These are pre-existing wiki gaps (a few "see also" targets were never
  // written); the port unlinks them, so warn rather than fail the build.
  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Parse .md as CommonMark (safe for wiki-authored content with raw HTML,
  // angle brackets, and braces) and reserve MDX for .mdx files.
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          // Single source of truth: generate the docs site straight from the
          // repo's existing docs/ folder (kept GitHub-native, no frontmatter).
          path: '../docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.js',
          // Skip non-guide files that live under docs/.
          exclude: [
            'README.md',
            'LINK_UPDATES.md',
            'user-guide-raw.md',
            'feedback/**',
            'mockups/**',
            'screenshots/**',
          ],
          editUrl: ({docPath}) =>
            `https://github.com/awslabs/filemoverexpress/edit/main/docs/${docPath}`,
        },
        blog: {
          routeBasePath: 'updates',
          showReadingTime: true,
          blogTitle: 'Updates',
          blogDescription: 'Release notes, benchmarks, and updates for File Mover Express',
          blogSidebarTitle: 'Recent updates',
          postsPerPage: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/awslabs/filemoverexpress/edit/main/website/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'File Mover Express',
        logo: {
          alt: 'File Mover Express',
          src: 'img/fme-logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Docs',
          },
          {to: '/updates', label: 'Updates', position: 'left'},
          {to: '/feedback', label: 'Feedback', position: 'left'},
          {
            href: 'https://github.com/awslabs/filemoverexpress',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Getting Started', to: '/docs/Getting-Started'},
              {label: 'Using the GUI', to: '/docs/Using-the-GUI'},
              {label: 'Using the CLI', to: '/docs/Using-the-CLI'},
              {label: 'MCP Server', to: '/docs/MCP-Server'},
            ],
          },
          {
            title: 'Community',
            items: [
              {label: 'GitHub', href: 'https://github.com/awslabs/filemoverexpress'},
              {label: 'Issues', href: 'https://github.com/awslabs/filemoverexpress/issues'},
              {label: 'Feedback', to: '/feedback'},
            ],
          },
          {
            title: 'More',
            items: [
              {label: 'Updates', to: '/updates'},
              {label: 'Amazon S3', href: 'https://aws.amazon.com/s3/'},
            ],
          },
        ],
        copyright: `Copyright &copy; ${new Date().getFullYear()} Amazon.com, Inc. or its affiliates. File Mover Express is open source under Apache-2.0.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml', 'go'],
      },
    }),
};

export default config;
