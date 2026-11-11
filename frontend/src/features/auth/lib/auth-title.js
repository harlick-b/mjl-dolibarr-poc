import { Urls } from '@/app/urls'
import { strings } from '@/locales/fr/AuthView'
import { strings as common } from '@/locales/fr/common'

export function authTitle(path) {
  return path === Urls.forgotPassword
    ? strings.forgotTitle
    : path === Urls.resetPassword
      ? strings.resetTitle
      : path === Urls.invitation
        ? strings.invitationTitle
        : path === Urls.verification
          ? strings.otpHeading
          : path === Urls.identity
            ? common.accountHeading
            : strings.loginHeading
}
