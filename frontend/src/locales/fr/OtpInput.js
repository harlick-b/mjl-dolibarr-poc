import LocalizedStrings from 'react-localization'

export const strings = new LocalizedStrings({
  fr: {
    otpLabel: 'Code de vérification',
    otpDigit: 'Chiffre {position} du code',
  },
})
strings.setLanguage('fr')
