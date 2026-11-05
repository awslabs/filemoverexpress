# Notifications

File Mover Express can post a message to your team chat when a transfer job
finishes or fails. It supports Slack, Microsoft Teams, Discord, Google Chat, and
any service that accepts a custom JSON webhook.

Each message includes the job name, the destination, the number of files, the
total size, and the transfer speed.

## How it works

You add one or more notification destinations in the app. A destination is a
named webhook target: a display name, the chat service it points at (the
preset), and the webhook URL the service gives you. For each destination you
choose whether it fires when a job finishes, when a job fails, or both.

Webhook URLs are secrets. File Mover Express stores them encrypted on disk, one
file per destination, and never writes them to `configuration.yaml`. Only
non-sensitive metadata (the name, the preset, a masked URL hint) is kept in the
configuration.

## Setting up a destination

Notifications are configured in the desktop app (the GUI).

1. Open **Settings** and go to the **Notifications** section.
2. Add a destination and give it a name.
3. Choose the service preset:
   - **Slack**
   - **Microsoft Teams** (see the note below)
   - **Discord**
   - **Google Chat**
   - **Custom JSON** for any other service that accepts a `{"text": ...}` webhook
4. Paste the webhook URL from that service.
5. Choose when it fires: **on finish**, **on failure**, or both.
6. Optionally mark one destination as the **default**.
7. Save.

To get a webhook URL, create an incoming webhook in the target service:

- **Slack**: create a Slack app, enable Incoming Webhooks, and add a webhook for
  the channel you want to post to.
- **Discord**: Channel settings > Integrations > Webhooks > New Webhook, then
  copy the webhook URL.
- **Google Chat**: in the target space, Apps & integrations > Webhooks, then copy
  the URL.
- **Microsoft Teams**: see below.

## Microsoft Teams

Microsoft retired the legacy Office 365 connector webhooks. Use a **Teams
Workflow** instead:

1. In the target Teams channel, open the **Workflows** app.
2. Search for and use the template **"Post to a channel when a webhook request
   is received"**.
3. Complete the flow and copy the generated URL.
4. Paste that URL into File Mover Express with the **Microsoft Teams** preset.

File Mover Express sends Teams an Adaptive Card, which is what the Workflows
webhook expects.

## Notify on every transfer

By default a destination only posts for jobs you start that match its
finish/failure settings. If you want a message for **every** transfer, including
hot-folder auto-uploads and CLI-driven jobs, enable **Notify on every transfer**.
This uses the default destination. Individual jobs can opt out.

## Security notes

- Webhook URLs are encrypted at rest and never leave the machine except as the
  outbound request to the webhook you configured.
- The sender refuses to post to internal, loopback, link-local, or cloud
  metadata addresses, so a webhook URL cannot be used to reach a private network
  endpoint.
- Failure notifications report a generic reason rather than the raw internal
  error, so sensitive detail is not leaked into a chat channel.

## See also

- [Hot Folders](Hot-Folders) - automatic uploads that can also notify
- [Configuration](Configuration) - where notification metadata lives
