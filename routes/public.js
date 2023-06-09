import debugLib from 'debug'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'

import { signerTokenApplication, verifierTokenApplication } from '@dugrema/millegrilles.nodejs/src/jwt.js'
import FichiersMiddleware from '@dugrema/millegrilles.nodejs/src/fichiersMiddleware.js'
import FichiersTransfertUpstream from '@dugrema/millegrilles.nodejs/src/fichiersTransfertUpstream.js'

const debug = debugLib('landing:public')

// Routes publiques
function routesPubliques(mq) {
    const fichiersMiddleware = new FichiersMiddleware(mq)
    const fichiersTransfertUpstream = new FichiersTransfertUpstream(mq)

    const router = express.Router()
    
    router.use((req, res, next)=>{
      req.fichiersMiddleware = fichiersMiddleware
      req.fichiersTransfert = fichiersTransfertUpstream
      next()
    })

    router.get('/token', getToken)
    router.post('/submit', express.json(), verifierToken, submitForm)
    router.use('/fichiers', verifierToken, routerFichiers(fichiersMiddleware))
    return router
}

export default routesPubliques
  
async function getToken(req, res) {
    const queryParams = req.query
    const application_id = queryParams.application_id
  
    if(!application_id) {
      debug("getToken ERREUR application_id manquant")
      return res.sendStatus(400)  // Manque application_id
    }
  
    const opts = {expiration: '2h'}
    const uuid_transaction = ''+uuidv4()
    const { cle: clePriveePem, fingerprint } = req.amqpdao.pki
    const token = await signerTokenApplication(fingerprint, clePriveePem, application_id, uuid_transaction, opts)
  
    return res.status(200).send({uuid_transaction, token})
}
  
export async function verifierToken(req, res, next) {
    const mq = req.amqpdao
    const body = req.body || {}
    const token = body.token || req.headers['x-token-jwt']
    if(!token) {
      debug("verifierToken ERREUR token manquant")
      return res.status(400).send({ok: false, err: 'Token manquant'})
    }
    try {
        var tokenInfo = await verifierTokenApplication(mq.pki, token)
        debug("verifierToken info ", tokenInfo)
        req.jwtsrc = token
        req.token = tokenInfo
        req.batchId = tokenInfo.payload.sub
        next()
    } catch(err) {
        console.error(new Date() + " ERROR landingFichiers Erreur token : ", err)
        return res.sendStatus(401)
    }
}

async function submitForm(req, res) {
    const mq = req.amqpdao,
          fichiersMiddleware = req.fichiersMiddleware,
          fichiersTransfert = req.fichiersTransfert
    const redisClient = req.redisClient  //amqpdaoInst.pki.redisClient
    const body = req.body
    debug("Submit form req :\n", body)

    // Verifier le token JWT
    const { message } = body
  
    if(!message) {
      debug("submitForm ERREUR message manquant")
      return res.status(400).send({ok: false, err: 'Message missing'})
    }
  
    try {
      const tokenInfo = req.token
      if(!tokenInfo) {
        debug("submitForm ERREUR token manquant")
        return res.status(401).send({ok: false, err: "Missing token"})
      }
      debug("Token Info : ", tokenInfo)
      const { extensions, payload } = tokenInfo
      if( ! extensions.roles.includes('landing_web') ) return res.status(403).send({ok: false, err: 'Invalid cert role'})
  
      const { application_id, sub: uuid_transaction, exp: expirationToken } = payload
      debug("Application Id : %s, uuid_transaction : %s", application_id, uuid_transaction)
  
      // S'assurer que le token n'a pas deja ete utilise avec redis
      const cleRedisSubmit = `landing:submit:${uuid_transaction}`
      const tokenDejaUtilise = await redisClient.get(cleRedisSubmit)
      if(tokenDejaUtilise) {
        debug("submitForm ERREUR Token deja utilise")
        return res.status(400).send({ok: false, err: 'Token deja utilise'})
      }

      // Charger configuration application
      const infoApplication = await mq.transmettreRequete('Landing', {application_id}, {action: 'getApplication', exchange: '2.prive'})
      debug("Info application ", infoApplication)
      const { actif } = infoApplication
      if(actif !== true) return res.status(503).send({ok: false, err: 'Application inactive'})

      // Creer transaction
      const transaction = await formatterTransactionMessagerie(mq, infoApplication, uuid_transaction, message)
      console.debug("Transaction ", transaction)

      // Preparer batch fichiers
      if(message.fuuids) {
        const pathSource = fichiersMiddleware.getPathBatch(uuid_transaction)
        await fichiersTransfert.takeTransfertBatch(uuid_transaction, pathSource)
      }

      // Soumettre la transaction
      const reponse = await mq.transmettreCommande('Messagerie', transaction, {action: 'recevoir', ajouterCertificat: true})
      debug("Reponse recevoir : ", reponse)

      // Ajouter cle dans redis pour bloquer reutilisation du token
      const ttl = expirationToken - Math.round(new Date().getTime()/1000) + 1
      redisClient.set(cleRedisSubmit, '1', {NX: true, EX: ttl})
        .catch(err=>console.error(new Date() + " ERROR submitForm Erreur sauvegarde cle redis submit " + cleRedisSubmit + " : " + err))
  
      // Declencher le transfert de fichiers
      fichiersTransfert.ajouterFichierConsignation(uuid_transaction)

      return res.status(201).send({ok: true, uuid_transaction})
    } catch(err) {
      console.error(new Date() + ' ERROR submitForm ', err)
      return res.sendStatus(500)
    }
  
}

async function formatterTransactionMessagerie(mq, infoApplication, uuid_transaction, message) {
  const { application_id, user_id } = infoApplication

  debug("Application Id : %s, uuid_transaction : %s", application_id, uuid_transaction)

  // Signer message
  const { commandeMaitrecles, enveloppeMessage } = message
  const messageMessagerie = {
    ...enveloppeMessage,
    application_id, 
    fingerprint_certificat: mq.pki.fingerprint,
  }
  const messageSigne = await mq.pki.formatterMessage(
    messageMessagerie, 'Landing', 
    {uuidTransaction: uuid_transaction, ajouterCertificat: true}
  )
  debug("Message signe : ", messageSigne)

  const commandeMaitreclesSignee = await mq.pki.formatterMessage(
    commandeMaitrecles, 'MaitreDesCles', 
    {action: 'sauvegarderCle', ajouterCertificat: true}
  )

  // Generer transaction de messagerie
  const transaction = {
    message: messageSigne,
    destinataires: [],  // Aucune adresse destinataire
    destinataires_user_id: [{user_id}],  // User IDs internes
    application_id,
    _cle: commandeMaitreclesSignee,
  }

  return transaction
}

// Router /landing/fichiers
function routerFichiers(fichiersMiddleware) {
  const router = express.Router()

  router.put('/:correlation/:position', fichiersMiddleware.middlewareRecevoirFichier())
  router.post('/:correlation', express.json(), fichiersMiddleware.middlewareReadyFichier())

  const deleteHandler = fichiersMiddleware.middlewareDeleteStaging()
  router.delete('/:correlation', deleteHandler)
  router.delete(deleteHandler)

  return router
}
