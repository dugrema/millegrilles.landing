import debugLib from 'debug'
import express from 'express'
import { signerTokenApplication, verifierTokenApplication } from '@dugrema/millegrilles.nodejs/src/jwt.js'
import { v4 as uuidv4 } from 'uuid'
const debug = debugLib('landing:route');

function initialiser(amqpdao, opts) {
  if(!opts) opts = {}
  const idmg = amqpdao.pki.idmg

  debug("IDMG: %s, AMQPDAO : %s", idmg, amqpdao !== undefined)

  const route = express.Router()

  // Section publique (aucune authentification, juste tokens JWT)
  route.use('/public', routesPubliques())

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

// Routes publiques
function routesPubliques() {
  const router = express.Router()

  // router.use((req)=>{
  //   req.ip
  // })

  router.use(protectionPublique)
  router.get('/token', getToken)
  router.post('/submit', express.json(), submitForm)

  return router
}

/** Compteur par adresse IP source pour eviter attaques */
function protectionPublique(req, res, next) {

  const publicIp = req.ip
  debug("protectionPublique ip : %s", publicIp)
  // TODO : ajouter IP a redis, verifier si compte est depasse (voir messagerie upload)  

  next()
}

async function getToken(req, res) {
  const queryParams = req.query
  const application_id = queryParams.application_id

  if(!application_id) return res.sendStatus(400)  // Manque application_id

  const opts = {expiration: '2h'}
  const uuid_transaction = ''+uuidv4()
  const { cle: clePriveePem, fingerprint } = req.amqpdao.pki
  const token = await signerTokenApplication(fingerprint, clePriveePem, application_id, uuid_transaction, opts)

  return res.status(200).send({uuid_transaction, token})
}


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

async function submitForm(req, res, next) {
  const body = req.body
  debug("Submit form req :\n", body)

  return res.sendStatus(201)
}