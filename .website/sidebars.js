// @ts-check

/**
 * FME documentation sidebar.
 *
 * The guides under docs/ are kept GitHub-native (no frontmatter), so page
 * titles come from each file's first H1 and the sidebar labels are set here
 * with the { type: 'doc', id, label } form. Ordering and grouping live here too.
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebars = {
  docs: [
    {type: 'doc', id: 'Home', label: 'Overview'},
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        {type: 'doc', id: 'Getting-Started', label: 'Getting Started'},
        {type: 'doc', id: 'Installation', label: 'Installation'},
        {type: 'doc', id: 'Headless-Linux-Installation', label: 'Headless Linux'},
        {type: 'doc', id: 'Quick-Start', label: 'Quick Start'},
        {type: 'doc', id: 'Key-Concepts', label: 'Key Concepts'},
        {type: 'doc', id: 'Setup', label: 'Setup'},
      ],
    },
    {
      type: 'category',
      label: 'Using FME',
      collapsed: false,
      items: [
        {type: 'doc', id: 'Using-the-GUI', label: 'Using the GUI'},
        {type: 'doc', id: 'Using-the-CLI', label: 'Using the CLI'},
        {type: 'doc', id: 'Configuration', label: 'Configuration'},
        {type: 'doc', id: 'Hot-Folders', label: 'Hot Folders'},
        {type: 'doc', id: 'Checksums', label: 'Checksums'},
      ],
    },
    {
      type: 'category',
      label: 'Authentication & Integrations',
      items: [
        {type: 'doc', id: 'OIDC-Authentication', label: 'OIDC / SSO'},
        {type: 'doc', id: 'MCP-Server', label: 'MCP Server'},
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        {type: 'doc', id: 'Best-Practices', label: 'Best Practices'},
        {type: 'doc', id: 'Security', label: 'Security'},
        {type: 'doc', id: 'Troubleshooting', label: 'Troubleshooting'},
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        {type: 'doc', id: 'Development', label: 'Development'},
        {type: 'doc', id: 'Contributing', label: 'Contributing'},
        {type: 'doc', id: 'Signing-Runbook', label: 'Code Signing'},
      ],
    },
  ],
};

export default sidebars;
