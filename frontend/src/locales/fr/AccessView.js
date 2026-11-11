import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    noMatches: 'Aucun élément ne correspond à votre recherche.',
    selectPartner: 'Sélectionner un Partenaire',
    usersLoading: 'Chargement des utilisateurs',
    invitationsTitle: 'Invitations',
    usersFilters: 'Filtrer les utilisateurs',
    userName: 'Nom',
    userScope: 'Rattachement',
    partnerScope: 'Partenaire',
    adminListLoading: 'Chargement de la liste',
    listUnavailable: 'Liste indisponible',
    listRetryPrompt:
      'Les données n’ont pas pu être chargées. Réessayez pour consulter la liste. Une invitation déjà envoyée reste valable.',
    listRetry: 'Actualiser',
    nameValidation:
      'Renseignez le prénom et le nom de famille, avec 200 caractères au total maximum.',
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    userSearchPlaceholder: 'Rechercher un utilisateur…',
    roleFilter: 'Rôle',
    allRoles: 'Tous les rôles',
    searchCriterion: 'Recherche : {query}',
    resetFilters: 'Réinitialiser',
    userCount: '{count} utilisateur',
    usersCount: '{count} utilisateurs',
  },
})
strings.setLanguage('fr')
