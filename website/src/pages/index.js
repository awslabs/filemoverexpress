import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Logo from '@site/src/components/Logo';
import styles from './index.module.css';

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
};

const FEATURES = [
  {icon: Icon.zap, title: 'Auto-tuned throughput', body: 'Parallel transfers and multipart optimization tune themselves to your pipe, with pause and resume across multi-file batches.'},
  {icon: Icon.pointer, title: 'GUI + CLI', body: 'A drag-and-drop desktop app for creatives, plus a scriptable CLI daemon for headless, remote, and multi-user setups.'},
  {icon: Icon.bot, title: 'MCP for AI assistants', body: 'Control transfers in natural language from Claude Desktop, Kiro, Cursor, and any MCP-compatible client.'},
  {icon: Icon.lock, title: 'OIDC / SSO sign-in', body: 'Authenticate with Okta, Microsoft Entra ID, Auth0, or Ping for temporary AWS credentials instead of long-lived keys.'},
  {icon: Icon.folder, title: 'Hot-folder monitoring', body: 'Designate local folders and FME automatically uploads new content to Amazon S3 as it lands.'},
  {icon: Icon.check, title: 'Checksum verification', body: 'Verify integrity end-to-end with MD5, XXHash, XXHash64, or XXH3, plus Media Hash List (MHL) support.'},
];

const STATS = [
  {n: '32.7', unit: 'Gbps', label: 'Many-file upload (LA \u2192 Oregon, m6in.16xlarge)'},
  {n: '4', unit: 'checksums', label: 'MD5 / XXHash / XXHash64 / XXH3 + MHL'},
  {n: '3', unit: 'platforms', label: 'macOS, Windows, and Linux'},
];

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <Logo size={72} className={styles.heroLogo} />
        <h1 className={styles.heroTitle}>
          Move media to S3 at <span className={styles.grad}>wire speed</span>
        </h1>
        <p className={styles.heroSub}>
          A high-performance, open-source file transfer app for moving media
          assets between local storage and Amazon S3. Drag-and-drop GUI,
          scriptable CLI, and an MCP server for AI assistants.
        </p>
        <div className={styles.cta}>
          <Link className={clsx('button button--primary button--lg', styles.ctaPrimary)} to="/docs/Getting-Started">
            Get Started
          </Link>
          <Link className="button button--secondary button--lg" href="https://github.com/awslabs/filemoverexpress">
            View on GitHub
          </Link>
        </div>
        <div className={styles.stats}>
          {STATS.map((s, i) => (
            <div className={styles.stat} key={i}>
              <div className={styles.statN}>
                <span>{s.n}</span> {s.unit}
              </div>
              <div className={styles.statL}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function Features() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Built for post-production workflows</h2>
      <div className={styles.cards}>
        {FEATURES.map((f, i) => (
          <div className={styles.card} key={i}>
            <div className={styles.cardIcon}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
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
        <div className={styles.browserBar}>
          <span className={styles.dot} style={{background: '#ff5f56'}} />
          <span className={styles.dot} style={{background: '#ffbd2e'}} />
          <span className={styles.dot} style={{background: '#27c93f'}} />
          <span className={styles.url}>File Mover Express &mdash; Active transfer</span>
        </div>
        <img src={shot} alt="File Mover Express GUI showing an active transfer" className={styles.shot} />
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} \u2014 ${siteConfig.tagline}`}
      description="High-performance open-source file transfer between local storage and Amazon S3, with a GUI, CLI, and MCP server.">
      <Hero />
      <main>
        <Features />
        <Preview />
      </main>
    </Layout>
  );
}
