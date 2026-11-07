import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    required:
      'Un Superviseur ou un Validateur doit créer le PTA pour cette année avant d’y ajouter ou d’y transférer une activité.',
    activities: 'Activités',
    create: 'Créer un PTA',
    edit: 'Modifier le PTA',
    createSubmit: 'Créer le PTA',
    save: 'Enregistrer',
    cancel: 'Annuler',
    project: 'Projet',
    year: 'Année',
    name: 'Nom du PTA',
    description: 'Description',
    optional: '(facultatif)',
    chooseProject: 'Sélectionner un projet',
    noProjects:
      'Aucun projet actif n’est disponible. Un Validateur doit créer un projet actif avant la création du PTA.',
    unavailable: 'Les projets ne sont pas disponibles.',
    previous: 'Précédent',
    next: 'Suivant',
    projectClosed: 'Ce projet est clos. Sélectionnez un projet actif.',
    uncertain:
      'L’enregistrement n’a pas pu être confirmé. Consultez les données actualisées du PTA avant de réessayer.',
    forbidden:
      'Vous n’êtes pas autorisé à enregistrer ce PTA. Votre saisie a été conservée.',
    failed: 'Le PTA n’a pas pu être enregistré. Réessayez.',
    duplicate:
      'Un PTA existe déjà pour ce projet et cette année. Consultez-le depuis Prévisions (PTA).',
    stale:
      'Ce PTA a été modifié. Fermez ce formulaire puis ouvrez-le à nouveau pour utiliser sa dernière version.',
    closed: 'Projet clos',
    breadcrumb: 'Prévisions (PTA)',
  },
})
strings.setLanguage('fr')
