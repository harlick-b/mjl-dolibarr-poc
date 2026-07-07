# Issue Tracker: GitHub

Needs confirmation: this repo appears to use GitHub Issues because `origin`
points to `https://github.com/harlick-b/mjl-dolibarr-poc.git`.

Issues and PRDs for this repo should be published as GitHub issues unless the
project owner confirms a different tracker. Use the `gh` CLI for tracker
operations when available.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply or remove labels with `gh issue edit`.
- Close issues with `gh issue close`.

Infer the repository from `git remote -v`; `gh` normally does this when run
inside the clone.

## Pull Requests As A Triage Surface

PRs as a request surface: no.

Set this to `yes` only if the project owner confirms that external PRs should
be triaged like incoming feature requests.

## When A Skill Says "Publish To The Issue Tracker"

Create a GitHub issue.

## When A Skill Says "Fetch The Relevant Ticket"

Run `gh issue view <number> --comments`, unless the user provided a specific
local path or another tracker reference.
