import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    forgotTitle: 'Mot de passe oublié',
    forgotHeading: 'Récupérer votre accès',
    forgotPrompt: 'Saisissez l’adresse e-mail associée à votre compte.',
    forgotSubmit: 'Envoyer le lien de récupération',
    forgotLink: 'Mot de passe oublié ?',
    forgotConfirmation:
      'Si ce compte peut être récupéré, vous recevrez un lien.',
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
