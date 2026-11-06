import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    eventsSingular: 'événement',
    eventsPlural: 'événements',
    events: 'événement(s)',
    newestFirst: 'Du plus récent au plus ancien',
    date: 'Date',
    action: 'Action',
    activity: 'Élément concerné',
    author: 'Auteur',
    exported: 'Export CSV généré.',
    unavailable: 'L’historique est momentanément indisponible.',
    historyTitle: 'Historique',
  },
})
strings.setLanguage('fr')
