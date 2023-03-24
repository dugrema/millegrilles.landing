import debugLib from 'debug'
import express from 'express'
import routesPubliques from './public.js'
import protectionPublique from './protectionpublique.js'
const debug = debugLib('landing:route')

function initialiser(amqpdao, opts) {
  if(!opts) opts = {}
  const idmg = amqpdao.pki.idmg

  debug("IDMG: %s, AMQPDAO : %s", idmg, amqpdao !== undefined)

  const route = express.Router()

  // Section publique (aucune authentification, juste tokens JWT)
  route.use('/public', routesPubliques(amqpdao))
  route.get('/protectionpublique', protectionPublique)

  // Section privee
  route.use(verifierAuthentificationPrivee)
  route.get('/info.json', routeInfo)
  route.get('/initSession', initSession)

  ajouterStaticRoute(route)

  debug("Route /landing de Landing est initialisee")

  // Retourner dictionnaire avec route pour server.js
  return route
}

export default initialiser

function verifierAuthentificationPrivee(req, res, next) {
  try {
      const session = req.session
      if( ! (session.nomUsager && session.userId) ) {
          debug("Nom usager/userId ne sont pas inclus dans les req.headers : %O", req.headers)
          res.append('Access-Control-Allow-Origin', '*')  // S'assurer que le message est recu cross-origin
          res.sendStatus(403)
          return
      } else {
          return next()
      }
  } catch(err) {
      console.error("apps.verifierAuthentification Erreur : %O", err)
  }
}

function initSession(req, res) {
  return res.sendStatus(200)
}

function ajouterStaticRoute(route) {
  var folderStatic =
    process.env.MG_LANDING_STATIC_RES ||
    process.env.MG_STATIC_RES ||
    'static/landing'

  route.use(express.static(folderStatic))
  debug("Route %s pour landing initialisee", folderStatic)
}

function routeInfo(req, res, next) {
  debug(req.headers)
  const idmg = req.idmg
  const nomUsager = req.headers['user-name']
  const userId = req.headers['user-id']
  const niveauSecurite = req.headers['user-securite']
  const host = req.headers.host

  const reponse = {idmg, nomUsager, userId, hostname: host, niveauSecurite}
  return res.send(reponse)
}

