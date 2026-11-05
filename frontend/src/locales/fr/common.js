import LocalizedStrings from 'react-localization'

// Only labels shared by multiple pages or controls belong here.
export const strings = new LocalizedStrings({
  fr: {
    pageLoading: 'Chargement : {page}',
    documentsLoading: 'Chargement des documents',
    previewLoading: 'Chargement de l’aperçu',
    usersTitle: 'Utilisateurs',
    accountHeading: 'Mon compte',
    loading: 'Chargement…',
    dataLoading: 'Chargement des données…',
    preview: 'Aperçu',
    download: 'Télécharger',
    dismiss: 'Fermer',
    previous: 'Précédent',
    next: 'Suivant',
    verifyAccess: 'Vérifier mon accès',
    identityUnavailable: 'Votre identité n’a pas pu être vérifiée.',
    noResults: 'Aucun résultat',
    serviceUnavailable: 'Service indisponible',
    dataUnavailable: 'Impossible de charger les données',
    retry: 'Réessayer',
    accessDenied: 'Accès refusé',
    accessDeniedMessage:
      'Vous ne disposez pas des autorisations nécessaires pour accéder à cette page.',
    returnToWorkspace: 'Retour à mon espace',
  },
})
strings.setLanguage('fr')
