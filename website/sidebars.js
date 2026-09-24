// @ts-check

/**
 * FME documentation sidebar. Ordering and grouping are defined here so the
 * ported guides do not need per-file sidebar_position frontmatter.
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'Getting-Started',
        'Installation',
        'Headless-Linux-Installation',
        'Quick-Start',
        'Key-Concepts',
        'Setup',
      ],
    },
    {
      type: 'category',
      label: 'Using FME',
      collapsed: false,
      items: [
        'Using-the-GUI',
        'Using-the-CLI',
        'Configuration',
        'Hot-Folders',
        'Checksums',
      ],
    },
    {
      type: 'category',
      label: 'Authentication & Integrations',
      items: [
        'OIDC-Authentication',
        'MCP-Server',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'Best-Practices',
        'Security',
        'Troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'Development',
        'Contributing',
        'Signing-Runbook',
      ],
    },
  ],
};

export default sidebars;
