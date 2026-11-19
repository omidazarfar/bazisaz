# Notes for Codex (and any other agent)

This project is worked on by two agents in turn, Claude Code and Codex.

1. **First, read `HANDOFF.md` in full.** It has where the work stands, how
   to talk to the owner, how to build, test and *see* your work, and the
   session log.
2. Follow the owner's rules in `CLAUDE.md`. They apply to every agent, not
   only Claude. In short:
   - Reply in Finglish, simply and step by step.
   - Games are in English and the editor in Persian.
   - No templates or starter games.
   - Keep `GUIDE-fa.md` up to date.
   - Run `npm run build`, then `npm test`, before calling anything done.
3. **At the end of your session, or when the owner says they are switching
   back,** update `HANDOFF.md`:
   - "Current state"
   - "Next steps"
   - a new dated entry at the top of "Session log"

   Then commit and push with git, as described in the "Git" section of
   `HANDOFF.md`. The repository is private on GitHub.
