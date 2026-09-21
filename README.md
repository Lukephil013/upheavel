# Upheavel
Open Projects from the taskbar and choose Upheavel. Standalone: `node server.mjs`, http://127.0.0.1:8793/.

Korean items stay in their review lists; check a box to cross an item out, or choose Notes to edit its notebook and links. Project headers and subsections are managed from the sidebar.

Click a Korean topic title to open its saved chat inside Upheavel. Study chats use GPT-5.6 Luna with medium reasoning, your existing ChatGPT subscription, and live web research. A hidden local Codex app-server handles the connection; no terminal window or API key is required. Your global Codex model is unchanged.

The message editor supports Markdown with bold, italic, strikethrough, headings, lists, quotes, code, and links, plus Preview. Ctrl+B/I/K format selected text, Enter sends, and Ctrl+Enter or Shift+Enter adds a line. Standard Windows selection, clipboard and undo/redo shortcuts work. Replies include Copy buttons. Stop interrupts a reply; closing the dialog lets it finish. Export chat downloads Markdown. Drafts save in this browser.

Each topic keeps its own Codex conversation. Reopening loads its history, including prior terminal conversations where available. Close an old terminal for that topic before sending from the browser. The full conversation is the study record; the browser chat does not update the older PROGRESS.md files.

Board data and drafts are stored at the exact browser origin; localhost and 127.0.0.1 are separate. Export backup covers the board only. Back up study-sessions and the normal Codex session store separately for chat recovery. study-launcher.json selects the installed Codex executable.

Validation: `node --test --test-isolation=none test/*.test.mjs`.

Shared learner context: learner-profile.md contains the dated Korean baseline and evidence limits. It is included when starting/resuming chats and refreshed before every message, so later profile updates also reach existing conversations.

Korean immersion mode: tutor replies and commentary are Korean. Hover or keyboard-focus an underlined Korean word to request a short contextual English gloss from Luna (low reasoning). Lookups are separate ephemeral dictionary requests, cached for repeated use during the server session. No dictionary request is added to the study conversation. A first lookup may take a few seconds and consumes subscription usage.

The chat fills the Upheavel panel. chat-settings.json selects a fresh conversation generation; old topic conversations and PROGRESS.md files are not loaded in this generation. Original files are retained as inactive history rather than permanently deleting the account-wide Codex session store. The shared level profile and board notebooks are preserved. Drafts are separated by conversation generation.

## Standalone setup

Requires Node.js and a Codex executable with app-server support, signed in with ChatGPT and access to the configured model.

1. Copy `study-launcher.example.json` to `study-launcher.json` and set `codexPath` to your installed Codex executable.
2. Optionally create `learner-profile.md` with your Korean level and learning preferences.
3. Run `node server.mjs` and open http://127.0.0.1:8793/.

The Projects taskbar launcher and navigation hub are separate local projects, not included in this repository. No npm dependencies are needed.

Click a multiple-choice answer to append it to your draft without sending. Existing draft text is preserved.

Personal profiles, local configuration, chat history, translation caches, runtime logs, and backups are excluded from Git. The repository does not back up personal study data.
