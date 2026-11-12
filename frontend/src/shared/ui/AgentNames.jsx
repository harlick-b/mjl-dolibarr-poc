export function AgentNames({ activityId, names }) {
  if (!names?.length) return '—'
  return (
    <ul className="grid list-none gap-1 p-0">
      {names.map((name, index) => (
        <li
          key={`${activityId}:agent:${index}`}
          className="break-words"
          title={name}
        >
          {name}
        </li>
      ))}
    </ul>
  )
}
