import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    read: 'Lue',
    unread: 'Non lue',
    deadlineTitle: 'Échéance de l’activité à venir',
    deadline: 'La fin prévue de cette activité est fixée au {date}.',
    openActivity: 'Ouvrir l’activité',
    readFailed: 'La relance n’a pas pu être marquée comme lue. Réessayez.',
    markedRead: 'Notification marquée comme lue.',
    unavailable: 'Les notifications sont momentanément indisponibles.',
    notificationsTitle: 'Notifications',
  },
})
strings.setLanguage('fr')
