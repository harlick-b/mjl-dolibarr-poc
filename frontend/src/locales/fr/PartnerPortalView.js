import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    exportsTitle: 'Exports',
    approvedData: 'Données approuvées',
    projectLabel: 'Projet',
    approvedActivities: 'activités approuvées',
    consultFiches: 'Consulter les fiches',
    portfolioUnavailable: 'Votre portefeuille est momentanément indisponible.',
    ptasUnavailable: 'Les PTA sont momentanément indisponibles.',
    activitiesUnavailable: 'Les Activités sont momentanément indisponibles.',
    detailUnavailable:
      'Le détail de l’Activité est momentanément indisponible.',
    ptaLabel: 'PTA',
    activitiesLabel: 'Activités',
    activityDetailLabel: 'Détail de l’Activité',
    partnerTitle: 'Espace Partenaire',
    partnerPtaCsv: 'Télécharger le récapitulatif CSV',
    partnerPtaCsvPending: 'Préparation du CSV…',
    partnerPtaCsvFailed:
      'Le téléchargement du CSV a échoué. Veuillez réessayer.',
  },
})
strings.setLanguage('fr')
