# Chrome Web Store submission draft

## Extension name

Plurk Conversation Exporter

## Short description

Export Plurk conversations with rich text, images, emotes, plain text, ZIP, or DOCX.

## Detailed description

Plurk Conversation Exporter extracts the current Plurk post and its replies and lets you copy or export the conversation for personal archiving and migration.

Features:

- Preview the current post and replies in a side panel.
- Copy rich text with formatting, links, images, and emotes.
- Copy portable plain text with numbered image markers.
- Download images and emotes as a ZIP with a mapping file.
- Export a self-contained DOCX with embedded images.
- Choose whether to include authors and images/emotes.

The extension processes conversation content locally in the browser. It does not provide a server-side account, analytics, or upload service. Image downloads use the current browser session for Plurk-hosted resources.

Use only with content that you are authorized to copy or archive. Exported files may contain names, messages, links, and images.

## Permission justification

- `activeTab`: identify the active Plurk tab when the user starts an extraction.
- `scripting`: inject the extractor into an already-open Plurk tab after installation or extension reload.
- `clipboardWrite`: copy rich text or plain text after the user clicks a copy action.
- `downloads`: save the user-requested ZIP or DOCX export.
- `sidePanel`: provide the extension user interface beside the Plurk page.
- Plurk host permissions: read the current Plurk conversation and fetch Plurk-hosted image and emote assets requested by the user.

## Privacy policy URL

Replace this placeholder with a public HTTPS URL to `PRIVACY_POLICY.md` before submitting.

## Suggested store assets

- 128x128 icon: `extension/icons/128bl2.png`
- At least one screenshot showing the side panel and a conversation preview.
- A second screenshot showing the export actions and DOCX/ZIP output workflow.
