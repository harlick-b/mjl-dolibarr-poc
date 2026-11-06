// Backdrop events target the dialog itself; padding and portalled selects must
// not dismiss it. Requiring both endpoints outside also preserves text selection.
export function outsideDialog(event) {
  if (event.target !== event.currentTarget) return false
  const box = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
}
