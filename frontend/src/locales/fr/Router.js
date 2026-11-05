import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    unexpectedTitle: 'Une erreur est survenue',
    reload: 'Recharger la page',
    unexpectedMessage:
      'Une erreur inattendue empêche l’affichage de cette page.',
    notFound: 'Page introuvable',
    notFoundMessage:
      'La page demandée est introuvable ou son adresse est incorrecte.',
  },
})
strings.setLanguage('fr')
