# Domain language

- **Activity**: the approved body of work and the parent for planning, execution,
  finance, validation and closure.
- **Task (`Tâche`)**: a work unit inside an Activity. It owns its Category,
  planned and authorized amounts, weight, dates and, when it has no Subtasks,
  Agent-entered progress. The database keeps the historical `Operation` model
  name; public API and product language use `task` / `tasks`.
- **Subtask (`Sous-tâche`)**: an optional child of one Task. It inherits the
  Task Category, has no independent authorization workflow and cannot have
  children.
- **Physical progress**: work completion expressed as an exact percentage. It
  is independent of expenditure, validation and closure.
- **Weight**: an exact percentage contribution. Task weights total 100% inside
  an Activity; Subtask weights total 100% inside their Task at submission.
- **Brief creator**: a Supervisor or Validator who creates an Activity shell and
  assigns its Agents. Brief creation alone is setup work, not content authorship.

