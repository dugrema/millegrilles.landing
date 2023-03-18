// Gestion evenements socket.io pour /millegrilles
import debugLib from 'debug'
import * as mqdao from './mqdao.js'

const debug = debugLib('landing:appSocketIo')

export function configurerEvenements(socket) {
  const configurationEvenements = {
    listenersPublics: [
      { eventName: 'challenge', callback: (params, cb) => traiter(socket, mqdao.challenge, {params, cb}) },
    ],
    listenersPrives: [
    ],
    listenersProteges: [
      {eventName: 'getListeApplications', callback: (params, cb) => traiter(socket, mqdao.getListeApplications, {params, cb}) },
      {eventName: 'getApplication', callback: (params, cb) => traiter(socket, mqdao.getApplication, {params, cb}) },
      {eventName: 'creerNouvelleApplication', callback: (params, cb) => traiter(socket, mqdao.creerNouvelleApplication, {params, cb}) },
      {eventName: 'sauvegarderApplication', callback: (params, cb) => traiter(socket, mqdao.sauvegarderApplication, {params, cb}) },

      // Listeners
      // {eventName: 'ecouterEvenementsCategoriesUsager', callback: (_, cb) => {mqdao.ecouterEvenementsCategoriesUsager(socket, cb)}},
    ]
  }

  return configurationEvenements
}

async function traiter(socket, methode, {params, cb}) {
  const reponse = await methode(socket, params)
  if(cb) cb(reponse)
}
