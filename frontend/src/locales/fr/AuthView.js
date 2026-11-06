import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    serviceLoginMessage:
      'Le service est momentanément indisponible. Votre accès local a été fermé. Réessayez pour vous connecter à nouveau.',
    retryConnection: 'Réessayer la connexion',
    offlineTitle: 'Connexion indisponible',
    offlineMessage: 'Vérifiez votre connexion Internet, puis réessayez.',
    sessionUnavailable: 'Session indisponible',
    identityUnavailable: 'Votre identité n’a pas pu être vérifiée.',
    invalidResetTitle: 'Lien de réinitialisation invalide ou expiré',
    invalidResetMessage:
      'Ce lien ne permet plus de réinitialiser votre mot de passe.',
    invalidInvitationTitle: 'Lien d’invitation invalide ou expiré',
    invalidInvitationMessage:
      'Ce lien n’est plus utilisable. Contactez votre administrateur pour recevoir une nouvelle invitation.',
    verificationFailed: 'Impossible de vérifier votre accès',
    verificationTitle: 'Vérification de votre accès',
    verificationFailedMessage:
      'Nous ne pouvons pas confirmer votre accès pour le moment.',
    verificationMessage: 'Nous vérifions votre session avant de poursuivre.',
    accountLoading: 'Chargement du compte',
    loginHeading: 'Connexion',
    loginSubmit: 'Se connecter',
    otpHeading: 'Vérification',
    otpPrompt: 'Saisissez le code envoyé à',
    otpEmailFallback: 'votre adresse e-mail',
    otpSubmit: 'Vérifier le code',
    otpNotReceived: 'Code non reçu ?',
    otpResend: 'Renvoyer le code',
    invitationTitle: 'Définir mon mot de passe',
    invitationPrompt: 'Définissez le mot de passe de votre compte.',
    invitationSubmit: 'Enregistrer le mot de passe',
    logoutHeading: 'Déconnexion',
    logoutUnconfirmed:
      'Déconnexion non confirmée. Réessayez lorsque la connexion est disponible.',
    retryLogout: 'Réessayer la déconnexion',
    forgotTitle: 'Mot de passe oublié',
    forgotHeading: 'Mot de passe oublié ?',
    forgotPrompt: 'Saisissez l’adresse e-mail associée à votre compte.',
    forgotSubmit: 'Envoyer le lien de réinitialisation',
    forgotLink: 'Mot de passe oublié ?',
    forgotConfirmation:
      'Votre demande a été prise en compte. Consultez votre messagerie pour les instructions de réinitialisation du mot de passe et pensez à vérifier vos courriers indésirables.',
    resetTitle: 'Réinitialiser le mot de passe',
    resetHeading: 'Réinitialiser mon mot de passe',
    resetPrompt: 'Choisissez un nouveau mot de passe.',
    resetSubmit: 'Réinitialiser le mot de passe',
    resetSuccess: 'Votre mot de passe a été réinitialisé.',
    invalidRecovery: 'Ce lien est invalide ou a expiré.',
    newRecovery: 'Demander un nouveau lien',
    emailLabel: 'Adresse e-mail',
    newPasswordLabel: 'Nouveau mot de passe',
    confirmationLabel: 'Confirmer le mot de passe',
    passwordMismatch: 'Les mots de passe ne correspondent pas.',
    backToLogin: 'Retour à la connexion',
  },
})
strings.setLanguage('fr')
