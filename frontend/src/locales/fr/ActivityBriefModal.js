import LocalizedStrings from 'react-localization'
export const strings = new LocalizedStrings({
  fr: {
    title: 'Créer et affecter une activité',
    name: 'Intitulé de l’activité',
    namePlaceholder: 'Ex. Organiser la concertation communale',
    description: 'Description / Instructions',
    descriptionPlaceholder: 'Précisez le résultat attendu…',
    optional: 'Facultatif',
    start: 'Date de début',
    end: 'Date de fin',
    agents: 'Confier à',
    chooseAgents: 'Sélectionner des Agents',
    search: 'Rechercher un Agent…',
    assignmentHelp: 'Au moins un Agent. Plusieurs sélections possibles.',
    help: 'Les Agents compléteront les opérations et le budget.',
    save: 'Créer et affecter',
    retry: 'Vérifier l’enregistrement',
    cancel: 'Annuler',
    previous: 'Précédent',
    next: 'Suivant',
    none: 'Aucun Agent disponible.',
    unavailable: 'Les Agents ne peuvent pas être chargés.',
    error:
      'L’activité n’a pas pu être enregistrée. Votre saisie a été conservée.',
    assignmentError:
      'Un Agent sélectionné n’est plus disponible. Vérifiez les affectations.',
    uncertain:
      'La réponse du service n’a pas été reçue. Vérifiez l’enregistrement pour reprendre la même demande sans créer de doublon.',
  },
})
strings.setLanguage('fr')
