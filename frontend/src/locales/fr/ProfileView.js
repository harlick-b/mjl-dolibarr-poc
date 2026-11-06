import LocalizedStrings from 'react-localization'
export const strings = new LocalizedStrings({
  fr: {
    title: 'Mon profil',
    reload: 'Recharger le profil et abandonner mes modifications',
    personal: 'Informations personnelles',
    firstName: 'Prénoms',
    lastName: 'Nom',
    email: 'Adresse email',
    role: 'Rôle',
    save: 'Enregistrer les modifications',
    saved: 'Votre profil a été mis à jour.',
    unavailable: 'Votre profil est momentanément indisponible.',
    failed: 'Votre profil n’a pas pu être enregistré. Réessayez.',
    conflict:
      'Votre profil a été modifié. Actualisez la page avant de réessayer.',
    legacy: 'Renseignez vos prénoms et votre nom pour compléter votre profil.',
  },
})
strings.setLanguage('fr')
