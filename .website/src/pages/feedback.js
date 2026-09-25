import React, {useState} from 'react';
import Layout from '@theme/Layout';
import Logo from '@site/src/components/Logo';
import styles from './feedback.module.css';

const FEEDBACK_EMAIL = 'fme-feedback@amazon.com';

export default function Feedback() {
  const [form, setForm] = useState({
    feedback_type: '',
    interface: '',
    operating_system: '',
    fme_version: '',
    message: '',
  });

  const update = (k) => (e) => setForm({...form, [k]: e.target.value});

  const onSubmit = (e) => {
    e.preventDefault();
    let body = '';
    body += 'Feedback Type: ' + form.feedback_type + '\n';
    if (form.interface) body += 'Interface: ' + form.interface + '\n';
    if (form.operating_system) body += 'OS: ' + form.operating_system + '\n';
    if (form.fme_version) body += 'Version: ' + form.fme_version + '\n';
    body += '\n---\n\n' + form.message;

    const subject = '[FME Feedback] ' + form.feedback_type;
    const mailto =
      'mailto:' +
      encodeURIComponent(FEEDBACK_EMAIL) +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body);
    window.location.href = mailto;
  };

  return (
    <Layout
      title="Feedback"
      description="Send feedback to the File Mover Express maintainers.">
      <div className={styles.wrap}>
        <div className={styles.container}>
          <header className={styles.header}>
            <Logo size={48} />
            <h1>File Mover Express Feedback</h1>
            <p>Help us improve FME. Your feedback goes directly to the maintainers.</p>
          </header>

          <div className={styles.notice}>
            <strong>How it works:</strong> Fill out the form below and click Send.
            Your email client will open with the feedback pre-filled &mdash; just hit
            send. You can remove your signature or any identifying info before sending
            if you prefer to stay anonymous.
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.group}>
              <label htmlFor="feedback-type">Feedback type</label>
              <select id="feedback-type" required value={form.feedback_type} onChange={update('feedback_type')}>
                <option value="" disabled>Select a category...</option>
                <option>General feedback</option>
                <option>Feature idea</option>
                <option>Bug report</option>
                <option>Performance issue</option>
                <option>Usability / UX</option>
                <option>Documentation</option>
                <option>Other</option>
              </select>
            </div>

            <div className={styles.group}>
              <label htmlFor="interface">Interface used <span className={styles.optional}>(optional)</span></label>
              <select id="interface" value={form.interface} onChange={update('interface')}>
                <option value="">Not specified</option>
                <option>GUI (Desktop app)</option>
                <option>CLI (Command line)</option>
                <option>Both</option>
              </select>
            </div>

            <div className={styles.group}>
              <label htmlFor="os">Operating system <span className={styles.optional}>(optional)</span></label>
              <select id="os" value={form.operating_system} onChange={update('operating_system')}>
                <option value="">Not specified</option>
                <option>macOS</option>
                <option>Windows</option>
                <option>Linux</option>
              </select>
            </div>

            <div className={styles.group}>
              <label htmlFor="version">FME version <span className={styles.optional}>(optional)</span></label>
              <input type="text" id="version" placeholder="e.g. 1.1.0" value={form.fme_version} onChange={update('fme_version')} />
            </div>

            <div className={styles.group}>
              <label htmlFor="message">Your feedback</label>
              <textarea id="message" required placeholder="Tell us what is on your mind..." value={form.message} onChange={update('message')} />
            </div>

            <button type="submit" className={styles.submit}>Send Feedback</button>
            <p className={styles.submitNote}>Opens your email client. You can review before sending.</p>
          </form>
        </div>
      </div>
    </Layout>
  );
}
