import React, {useState, useEffect} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Logo from '@site/src/components/Logo';
import styles from './index.module.css';

const REPO = 'awslabs/filemoverexpress';
// GitHub "latest" permalink: always redirects to the newest release's asset,
// so these links never go stale when a new version is published.
const DL = `https://github.com/${REPO}/releases/latest/download`;
const RELEASES_URL = `https://github.com/${REPO}/releases`;

// Lucide-style inline icons (stroked), no emoji.
const Icon = {
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  pointer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  ),
  bot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 3h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path d="M12 11v5" />
      <path d="M9.5 13.5L12 11l2.5 2.5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

// Platform glyphs for the download cards.
const OsGlyph = {
  mac: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 12.78c.02 2.19 1.92 2.92 1.94 2.93-.016.05-.303 1.04-1 2.06-.603.89-1.23 1.77-2.22 1.79-.97.02-1.28-.57-2.39-.57-1.11 0-1.46.55-2.38.59-.95.04-1.68-.96-2.29-1.84-1.25-1.81-2.2-5.11-.92-7.34.64-1.11 1.78-1.81 3.02-1.83.94-.02 1.83.63 2.4.63.57 0 1.65-.78 2.78-.67.47.02 1.8.19 2.65 1.43-.07.04-1.58.92-1.56 2.75zM14.56 7.4c.5-.61.84-1.46.75-2.31-.72.03-1.6.48-2.12 1.09-.47.54-.88 1.4-.77 2.23.8.06 1.63-.41 2.14-1.01z" />
    </svg>
  ),
  win: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 5.4 10.4 4.4v6.9H3zM11.3 4.28 21 3v8.3h-9.7zM3 12.2h7.4v6.9L3 18.1zM11.3 12.2H21V21l-9.7-1.3z" />
    </svg>
  ),
  linux: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17l6-6-6-6" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
};

const FEATURES = [
  {icon: Icon.zap, title: 'Auto-tuned throughput', to: '/docs/Best-Practices', body: 'Parallel transfers and multipart optimization tune themselves to your pipe, with pause and resume across multi-file batches.'},
  {icon: Icon.pointer, title: 'GUI + CLI', to: '/docs/Using-the-GUI', body: 'A drag-and-drop desktop app for creatives, plus a scriptable CLI daemon for headless, remote, and multi-user setups.'},
  {icon: Icon.bot, title: 'MCP for AI assistants', to: '/docs/MCP-Server', body: 'Control transfers in natural language from Claude Desktop, Kiro, Cursor, and any MCP-compatible client.'},
  {icon: Icon.lock, title: 'OIDC / SSO sign-in', to: '/docs/OIDC-Authentication', body: 'Authenticate with Okta, Microsoft Entra ID, Auth0, or Ping for temporary AWS credentials instead of long-lived keys.'},
  {icon: Icon.folder, title: 'Hot-folder monitoring', to: '/docs/Hot-Folders', body: 'Designate local folders and FME automatically uploads new content to Amazon S3 as it lands.'},
  {icon: Icon.check, title: 'Checksum verification', to: '/docs/Checksums', body: 'Verify integrity end-to-end with MD5, XXHash, XXHash64, or XXH3, plus Media Hash List (MHL) support.'},
];

const PLATFORMS = [
  {
    id: 'mac',
    name: 'macOS',
    glyph: OsGlyph.mac,
    kind: 'Desktop app (.dmg)',
    builds: [
      {label: 'Apple Silicon', href: `${DL}/filemoverexpress-macos-arm64.dmg`},
      {label: 'Intel', href: `${DL}/filemoverexpress-macos-x64.dmg`},
    ],
  },
  {
    id: 'win',
    name: 'Windows',
    glyph: OsGlyph.win,
    kind: 'Desktop app (installer)',
    builds: [
      {label: 'x64', href: `${DL}/filemoverexpress-windows-amd64-installer.exe`},
      {label: 'ARM64', href: `${DL}/filemoverexpress-windows-arm64-installer.exe`},
    ],
  },
  {
    id: 'linux',
    name: 'Linux',
    glyph: OsGlyph.linux,
    kind: 'Headless CLI daemon (no GUI)',
    builds: [
      {label: 'x86_64', href: `${DL}/filemoverexpress-linux-amd64`},
      {label: 'ARM64', href: `${DL}/filemoverexpress-linux-arm64`},
    ],
  },
  {
    id: 'mcp',
    name: 'MCP server',
    glyph: Icon.bot,
    kind: 'For AI assistants (Claude, Kiro, Cursor)',
    builds: [{label: 'All MCP binaries', href: `${RELEASES_URL}/latest`}],
  },
];

// The visitor's platform, and the hero button target. Detection runs only in
// the browser (SSR-safe): server render assumes "other" and the effect
// upgrades it after mount.
const PRIMARY = {
  mac: {label: 'Download for macOS', href: `${DL}/filemoverexpress-macos-arm64.dmg`},
  win: {label: 'Download for Windows', href: `${DL}/filemoverexpress-windows-amd64-installer.exe`},
  linux: {label: 'Download for Linux', href: `${DL}/filemoverexpress-linux-amd64`},
  other: {label: 'Download', href: '#downloads'},
};

function detectOs() {
  if (typeof navigator === 'undefined') return 'other';
  const s = `${navigator.platform || ''} ${navigator.userAgent || ''}`;
  if (/Mac/i.test(s)) return 'mac';
  if (/Win/i.test(s)) return 'win';
  if (/Linux|Android/i.test(s)) return 'linux';
  return 'other';
}

function useReleaseInfo() {
  const [os, setOs] = useState('other');
  const [version, setVersion] = useState(null);
  useEffect(() => {
    setOs(detectOs());
    let alive = true;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && d.tag_name) setVersion(d.tag_name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return {os, version};
}

function Hero({os, version}) {
  const primary = PRIMARY[os] || PRIMARY.other;
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <Logo size={72} className={styles.heroLogo} />
        <div className={styles.heroWordmark}>File Mover Express</div>
        <h1 className={styles.heroTitle}>
          Move media to S3 at <span className={styles.grad}>wire speed</span>
        </h1>
        <p className={styles.heroSub}>
          A high-performance, open-source file transfer app for moving media
          assets between local storage and Amazon S3. Drag-and-drop GUI,
          scriptable CLI, and an MCP server for AI assistants.
        </p>
        <div className={styles.cta}>
          <Link className={clsx('button button--primary button--lg', styles.ctaPrimary)} href={primary.href}>
            <span className={styles.dlBtnInner}>
              <span className={styles.dlIcon}>{Icon.download}</span>
              {primary.label}
            </span>
          </Link>
          <Link className="button button--secondary button--lg" href="https://github.com/awslabs/filemoverexpress">
            View on GitHub
          </Link>
        </div>
        <div className={styles.heroDlMeta}>
          {version ? (
            <>
              Latest release <span className={styles.verBadge}>{version}</span>
            </>
          ) : (
            'Free and open source'
          )}
          {' \u00b7 '}
          <a href="#downloads">All platforms</a>
        </div>
      </div>
    </header>
  );
}

function Downloads({os}) {
  return (
    <section className={styles.dlSection} id="downloads">
      <h2 className={styles.sectionTitle}>Download File Mover Express</h2>
      <p className={styles.dlLede}>Free and open source. Pick your platform below.</p>
      <div className={styles.dlGrid}>
        {PLATFORMS.map((p) => {
          const isYou = p.id === os;
          return (
            <div className={clsx(styles.dlCard, isYou && styles.dlCardYou)} key={p.id}>
              <div className={styles.dlOs}>
                <span className={styles.dlOsGlyph}>{p.glyph}</span>
                {p.name}
                {isYou && <span className={styles.dlYouTag}>Your system</span>}
              </div>
              <div className={styles.dlKind}>{p.kind}</div>
              <div className={styles.dlBuilds}>
                {p.builds.map((b) => (
                  <a className={styles.dlBuildBtn} href={b.href} key={b.label}>
                    {b.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.dlNote}>
        Looking for older versions or checksums? See{' '}
        <a href={RELEASES_URL}>all releases on GitHub</a>. Building from source? See the{' '}
        <Link to="/docs/Installation">Installation guide</Link>.
      </p>
    </section>
  );
}

function Features() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Built for post-production workflows</h2>
      <div className={styles.cards}>
        {FEATURES.map((f, i) => (
          <Link className={styles.card} to={f.to} key={i}>
            <div className={styles.cardIcon}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <span className={styles.cardMore}>Learn more &rarr;</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Preview() {
  const shot = useBaseUrl('/img/screenshots/01-active-transfer.png');
  return (
    <section className={styles.previewWrap}>
      <h2 className={styles.sectionTitle}>See it in action</h2>
      <div className={styles.browser}>
        <img src={shot} alt="File Mover Express GUI showing an active transfer" className={styles.shot} />
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  const {os, version} = useReleaseInfo();
  return (
    <Layout
      title={`${siteConfig.title} \u2014 ${siteConfig.tagline}`}
      description="High-performance open-source file transfer between local storage and Amazon S3, with a GUI, CLI, and MCP server.">
      <Hero os={os} version={version} />
      <main>
        <Downloads os={os} />
        <Features />
        <Preview />
      </main>
    </Layout>
  );
}
