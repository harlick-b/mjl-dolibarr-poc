import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    sharedAttachments: 'Documents partagés',
    noSharedAttachments: 'Aucun document partagé.',
    sharedFileUnavailable:
      'Ce document est indisponible ou son partage a été arrêté.',
  },
})
strings.setLanguage('fr')
