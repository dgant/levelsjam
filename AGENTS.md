Read all .md files in this directory for project-specific context.

# On Agent-Human Collaboration

- I intend these collaboration guidelines to maximize our collective rate of progress.
- We want to make as much progress per day as possible.
- I, the human, am the bottleneck.
- You can do hundreds of things in the time it takes me to do one.
- These guidelines aim to empower you and make the best use of my limited time.

## Prompting
- I can only reply intermittently.
- When you wait on me for a prompt, progress halts.
- So I want you to make as much progress on your own as you can. Don't prompt me if you can make progress without me.
- If you are considering between options, don't ask me. Just pick the one you like best and tell me about it when you're done.
- If I say I'm going to sleep, I will not be able to reply for ten hours. So you should attempt ten hours of uninterrupted progress.

## Testing
- Showing me incomplete or broken artifacts halts progress.
- So observe and test your work before telling me it's done.
- Maintain unit tests for easily-encapsulated logic.
- Maintain integration tests to ensure end-to-end functionality.
- Find ways to test even your graphical interfaces.
- Anything a human would see or interact with is worth testing.
- Make especially sure to verify your newest changes.
- Because if I ask you to add or fix X, and you return back missing or broken X, that wastes a lot of time.
- Be proactive and creative in how you test.
- Do not abide new errors or warnings in log outputs.
- Log errors must either have their root causes fixed, or be provably irrelevant and silenced.

## Sandboxing
- In order for you to progress as fast as possible, you need to operate with minimal restrictions.
- To safely operate with minimal restrictions, you need to do all substantial work inside a container.
- To be fully empowered within that container, you are primarily responsible for composing that container.
- You will maintain your own docker-compose.yml and include any software you need.
- Do not install software in a way that is not robust to container restarts.
- I can restart your container if needed but this is expensive because I am the bottleneck.
- So if you need me to restart your container, try to batch all changes you need into a single restart.
- Plan ahead for your near-future container needs to avoid excess container restarts.
- Ideally there is only one service inside the container named "app".
- Do not prematurely separate services into separate ones for development and production.
- Assume development and production environments are identical until explicitly requested otherwise.

## Agent configuration
- You will be run from a project directory.
- The project directory will likely be /e/p/{project_directory} on the host machine and /workspace from inside the container.
- If I ask you to modify your settings, prefer modifying your local configuration files (like .codex-home), not your global settings.
- Although you will do most of your work inside the container, I may consult you outside the container for how to compose the container or if it has issues.
- Thus you should configure your settings so that `codex resume --last` should work whether invoked inside the container from /workspace or or outside the container from {project_directory}.

## Source Control
- Projects should be tracked in Git and pushed regularly to GitHub.
- If you are missing tokens for that, do ask me and I will provide them.
- Your commits, pull requests, comments, etc. should identify you as an agent, rather than just as me, when reasonable. If there is no way for your username to appear as an agent, indicate it at the start of each comment/pull request like "Codex:" or "Claude:" as appropriate.
- Before handing any work back to me, commit and push your work, and provide a link to the diff on GitHub.
- If you have been working on a problem for a while without successful working revisions, and finally get one, tag it.

## Learning
- If I give a suggestion for how you should operate going forward, it is important for you to remember that, and important for me to track what suggestions need to be made.
- So append such suggestions to a UPDATES.md
- Maintain instructions for how to use and test the software we create in a HUMANS.md
- Maintain a canonical throrough specification of the software's required features in SPEC.md
- These documents should each be self-contained and legible to a reader with no other context
- Update `SPEC.md` before implementing any new user-requested behavior, constraint, rule clarification, UI change, or inferred requirement.
- Write requirements in the affirmative.
- Do not reference this conversation, external context, or unstated assumptions inside `SPEC.md`.
- Keep `SPEC.md` self-contained and sufficient for a new contributor to understand:
  - gameplay rules
  - implemented scope
  - UI/UX requirements
  - animation requirements
  - testing expectations
  - performance expectations
- When rule details are known from the historic rulebook or explicit card text, include them in `SPEC.md`.
- When behavior is inferred for coherence, state the inferred requirement plainly in `SPEC.md`.

## Self-Improvement
- Be relentless in solving problems.
- But if you have been stuck on a problem for a while, take a step back and evaluate what is systematically causing problems.
- Do not allow operations to become unreasonably slow. Monitor how long things take and if it feels excessive, it probably is and you should find a way to make it faster, as part of meeting your current goal
- Journal things you've learned in a LESSONS.md so you and future agents can avoid the same hazards.
- If you are frequently waiting on long-running processes, try to make them faster.
- Don't guess at the cause of the problem when you can prove, inspect, or test the cause.
- If you lack the information to diagnose the problem, proactively extract and log the information you need.

## Development Process
- Implement only features I have explicitly requested. Do not add features speculatively.
- Before starting a nontrivial task, think about your plan, including how it will play nicely with existing features and other known tasks.
- To fix a bug, create a reproducible test case first, then verify that it is passing after your fix.
- Handle only provably likely errors. Do not speculatively handle errors that have not occurred or are likely to not occur. 
- Remove your own unused code. If I ask for a feature to be removed, remove the code for that feature as well. 
- Remove old log files. Anything unrelated to your current task or older than a day should be removed.
- Give log files human-legible filenames so I can inspect them too.
- Passwords and credentials must NEVER be stored in source-controlled files. By default these should be in .env and it is crucial for .env to be included in .gitignore
- Avoid newline (CRLF/LF), tab-vs-space, or other pure whitespace changes unless functionally necessary. These fill up diffs and make them harder to read. Fixing indentation depth is okay when the indentation depth has changed.
- Make changes via sub-agent. When I have requested multiple changes, attempt to divide them among sub-agents. Work that would touch the same areas or files or features should probably belong to one sub-agent so multiple agents don't trample each other's work. Sub-agents should report what they've done in a way that is visible to you.


