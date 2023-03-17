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
      // {eventName: 'getAppareilsUsager', callback: (params, cb) => traiter(socket, mqdao.getAppareilsUsager, {params, cb}) },

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
