# OIDC / SSO Authentication

File Mover Express can authenticate to AWS using your organization's **single
sign-on (SSO)** identity provider instead of long-lived AWS access keys or a
local AWS named profile. Users sign in with their normal corporate credentials
(Okta, Microsoft Entra ID, Auth0, Ping, Dex, etc.), and FME exchanges that login
for **temporary** AWS credentials scoped to a specific IAM role.

This is the recommended way to give a team access to a shared S3 bucket: there
are no static keys to distribute or rotate, access follows the user's identity,
and credentials expire automatically.

> **Scope:** OIDC is configured **per Remote Configuration** (per bucket
> connection). One Remote Configuration can use SSO while another uses an AWS
> named profile.

---

## How it works

```
You click "Sign in"  ─▶  Browser opens your identity provider's login page
        │
        ▼
You log in (and MFA)  ─▶  Provider returns an identity token (ID token) to FME
        │
        ▼
FME calls AWS STS      ─▶  AWS returns TEMPORARY credentials for an IAM role
 (AssumeRoleWithWebIdentity)
        │
        ▼
FME browses / transfers your S3 bucket using those temporary credentials
```

- FME uses the **Authorization Code flow with PKCE** as a *public client* — there
  is no client secret stored in the app.
- The browser login redirects back to a short-lived local listener on
  `127.0.0.1` (ports `9876`, `9877`, or `9878`).
- The temporary AWS credentials expire (1 hour by default). FME refreshes them
  behind the scenes; if you enable session persistence it can also restore your
  session after a restart without a new login.

Everyone who signs in through a given Remote Configuration assumes the **same
IAM role**, so they all get the same S3 permissions. Access is controlled in your
identity provider (who can log in) and in the IAM role (what they can do).

---

## Prerequisites

You (or an administrator) need three things set up once:

1. An **OIDC identity provider** with a registered application/client for FME.
2. An **IAM identity provider** in your AWS account that trusts that OIDC issuer.
3. An **IAM role** that the identity provider is allowed to assume, with the S3
   permissions your users need.

The sections below walk through each. If your administrator has already done
this, skip to [Configuring a Remote Configuration in FME](#configuring-a-remote-configuration-in-fme).

---

## Part 1 — Register FME in your identity provider

Create a **Native / Desktop** application (a *public* OAuth client that uses
PKCE — no client secret). Configure it as follows:

| Setting | Value |
|---|---|
| Application type | Native / Desktop (public client, PKCE) |
| Grant type | `authorization_code` |
| Client authentication | None (PKCE `S256`) |
| Sign-in redirect URIs | `http://127.0.0.1:9876/callback`<br>`http://127.0.0.1:9877/callback`<br>`http://127.0.0.1:9878/callback` |
| Scopes | `openid`, `email`, `profile`, `offline_access` |

Notes:

- **Register all three redirect URIs.** FME tries ports 9876 → 9877 → 9878 in
  order and uses the first one that's free.
- Use `127.0.0.1`, **not** `localhost` — this is the standard for desktop OAuth
  clients ([RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3)),
  and some providers treat the two as different redirect URIs.
- `offline_access` is required if you want FME to **remember the session across
  restarts** (it's what lets the provider issue a refresh token).

Record two values you'll need later:

- **Issuer URL** — e.g. `https://idp.example.com` (or `https://idp.example.com/oidc`).
- **Client ID** — e.g. `fme-desktop`.

---

## Part 2 — Trust the provider in AWS (IAM)

In the AWS account that owns your bucket:

### 2a. Create an IAM OIDC identity provider

- **Provider URL:** your issuer URL (e.g. `https://idp.example.com`).
- **Audience:** your FME client ID (e.g. `fme-desktop`).

AWS records this as an OIDC provider ARN like:

```
arn:aws:iam::123456789012:oidc-provider/idp.example.com
```

### 2b. Create the IAM role FME will assume

Create a role for **Web identity**, selecting the provider above, and attach a
trust policy that pins both the audience and the issuer:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/idp.example.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "idp.example.com:aud": "fme-desktop"
        }
      }
    }
  ]
}
```

> Replace `123456789012`, `idp.example.com`, and `fme-desktop` with your real
> account ID, issuer host (no `https://`), and client ID.

### 2c. Give the role S3 permissions

Attach a permissions policy granting the access your users need on the target
bucket. A minimal read/write example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::my-media-bucket"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-media-bucket/*"
    }
  ]
}
```

Record the **Role ARN** (e.g. `arn:aws:iam::123456789012:role/FMERole`).

> **Optionally scope access per user.** Because everyone assumes the same role,
> you can narrow *what a session can do* using the token's claims — for example a
> trust-policy condition on the `sub` claim, or session tags. Start simple (one
> shared role) and add this later if you need per-user boundaries.

---

## Configuring a Remote Configuration in FME

### Using the GUI

1. Open **Remote Configuration** (add a new one, or edit an existing one).
2. Go to the **Authentication** tab.
3. Set **Authentication method** to **OIDC / SSO**.
4. Fill in the OIDC fields:

| Field | Required | What to enter |
|---|:---:|---|
| **Issuer URL** | ✅ | Your provider's issuer, e.g. `https://idp.example.com` |
| **Client ID** | ✅ | The FME client ID, e.g. `fme-desktop` |
| **Role ARN** | ✅ | The IAM role to assume, e.g. `arn:aws:iam::123456789012:role/FMERole` |
| **Scopes** | | Defaults to `openid, email, profile, offline_access`. Leave as-is unless your provider needs different scopes. |
| **Session duration (seconds)** | | How long assumed credentials last. `0` uses the STS default (3600). Allowed range 900–43200. Can't exceed the role's max session duration. |
| **Custom CA bundle** | | Path to a PEM file, only if your issuer uses an internal/private certificate authority. |
| **Remember session across restarts** | | When on, FME stores the refresh token (encrypted) so you don't have to sign in again after restarting. Requires the `offline_access` scope. |

5. Save. On the **Connection** tab, set the bucket and region as usual.

### Config file equivalent

The daemon stores this in its configuration file (`~/.filemoverexpress/configuration.yaml`
on macOS/Linux). The GUI is the recommended way to edit it, but the OIDC block
looks like this under the relevant transfer profile:

```yaml
protocols:
  s3:
    transferProfiles:
      my-media:
        bucket: my-media-bucket
        region: us-east-1
        authMethod: 2            # 2 = OIDC / SSO (1 = AWS named profile)
        oidcConfig:
          issuerUrl: https://idp.example.com
          clientId: fme-desktop
          roleArn: arn:aws:iam::123456789012:role/FMERole
          scopes: [openid, email, profile, offline_access]
          persistSession: true
          sessionDurationSeconds: 0
          customCaBundle: ""
```

---

## Signing in

1. Select the OIDC Remote Configuration in the S3 browser.
2. The file panel shows **Sign In Required** with a **Sign in** button (instead of
   a file list).
3. Click **Sign in**. Your default browser opens your provider's login page.
4. Complete login (and MFA if required), then return to FME — the bucket loads
   automatically.

After signing in, the toolbar shows a small **sign-out** control. Click it to end
the session and clear the cached credentials.

If **Remember session across restarts** is enabled, FME restores your session on
next launch without prompting, until the refresh token expires or you sign out.

---

## Inviting other people to test / use it

Whether you need to assign the app to each user depends on your identity
provider's settings. In Okta, for example, apps in **Federation Broker Mode**
skip per-user assignment — any active user in your org can sign in through FME
(app-initiated login), and the Assignments tab is disabled by design. To restrict
access to specific people, turn Federation Broker Mode off and assign users or
groups explicitly.

No matter the provider, a new tester only needs to be **allowed to log in** to the
FME application in your IdP. They don't need any AWS setup of their own — they
assume the shared IAM role automatically after signing in.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser doesn't open when you click **Sign in** | Another app is holding all three callback ports, or the browser launch was blocked | Close whatever is using ports 9876–9878; try again. Check the daemon log for the login URL. |
| Provider shows a **redirect URI mismatch** error | The callback URI isn't registered (or used `localhost` instead of `127.0.0.1`) | Register all three `http://127.0.0.1:98xx/callback` URIs exactly, including port and `/callback` path. |
| Login succeeds but bucket shows an AWS error | The IAM role's permissions don't cover the bucket/prefix | Adjust the role's S3 permissions policy. |
| `InvalidIdentityToken` / `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy `aud`/`iss` don't match, or the IAM OIDC provider isn't set up | Confirm the IAM OIDC provider audience = your client ID and the trust policy issuer host matches your issuer URL. |
| Saving the config complains that offline_access is required | **Remember session** is on but `offline_access` isn't in the scopes | Add `offline_access` to the scopes, or turn off "Remember session across restarts". |
| Session doesn't survive a restart | Persistence off, or provider didn't issue a refresh token | Enable **Remember session across restarts** and ensure `offline_access` is both requested here and allowed in the IdP app. |
| TLS / certificate error contacting the issuer | Issuer uses an internal CA the OS doesn't trust | Set **Custom CA bundle** to the PEM file for your internal CA. |

---

## Security notes

- FME never stores a client secret — it's a PKCE public client.
- AWS credentials are **temporary** and expire; there are no long-lived keys on
  disk for the OIDC path.
- When session persistence is on, the **refresh token** is stored encrypted on the
  local machine. Treat that machine as you would any signed-in workstation, and
  use **Sign out** on shared computers.
- Access is governed in two places: who can log in (your IdP) and what the role
  can do (the IAM role's policies). Keep the role scoped to only the buckets and
  actions users actually need.

---

## Related

- [Configuration](Configuration.md) — full configuration reference
- [Security](Security.md) — security model and best practices
- [Using the GUI](Using-the-GUI.md) — the desktop app walkthrough
