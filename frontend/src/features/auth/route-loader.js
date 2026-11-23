import { Urls } from '@/app/urls'

export async function loadAuthProof(path, { context, abortController }) {
  let proof
  if (window.location.hash) {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    proof = {
      selector: fragment.get('selector') || '',
      verifier: fragment.get('verifier') || '',
    }
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    )
  }
  try {
    const session = await context.access.verify()
    if (proof) {
      const endpoint =
        path === Urls.invitation
          ? 'invitations/inspect'
          : 'password-reset/inspect'
      const invited = await context.api.auth(endpoint, {
        csrf: session.csrf,
        body: proof,
        signal: abortController.signal,
      })
      return { proof, email: invited.email }
    }
  } catch {
    /* The view offers a deliberate retry or an invalid-link message. */
  }
  return null
}
