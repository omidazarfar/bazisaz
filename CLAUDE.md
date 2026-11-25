# Notes for Claude

- **Asked to make a game rather than change the engine?** Read `AGENTS-GAMES.md` and use `scripts/game.mjs`.
- **Start by reading `HANDOFF.md`.** The owner switches between Claude Code and
  Codex, and that file says what the other agent did last. At the end of a
  session, or when the owner says they are switching, update it: current
  state, next steps, and a dated log entry at the top. These rules apply to
  Codex too (see `AGENTS.md`).
- Reply in Finglish (Persian in Latin letters): Persian script renders badly
  in the owner's terminal. Ask questions in plain text with numbered options,
  not pop-up dialogs.

- The owner is a founder, not a programmer. Answer simply and step by step
  (in Finglish, as above), and explain each step you take with an example.
- What the product is, the decisions made so far and what is still unverified:
  the section "Where the project stands" in `README.md`.
- How the editor is used, in Persian: `GUIDE-fa.md`. Keep it in step with any
  change a user would notice.
- Games are in English; the editor is in Persian. No templates or starter games.
  Ads, sign-up and hosting are set aside for now.
- Before saying a change is done: `npm run build`, then `npm test` (needs Chrome;
  set `CHROME_PATH` if it is not in the usual place).
