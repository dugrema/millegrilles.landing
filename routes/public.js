import debugLib from 'debug'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'

import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes.js'
import { signerTokenApplication, verifierTokenApplication } from '@dugrema/millegrilles.nodejs/src/jwt.js'
import FichiersMiddleware from '@dugrema/millegrilles.nodejs/src/fichiersMiddleware.js'
import FichiersTransfertUpstream from '@dugrema/millegrilles.nodejs/src/fichiersTransfertUpstream.js'

const debug = debugLib('landing:public')

// Routes publiques
function routesPubliques(mq) {
 
    const PATH_STAGING = process.env.PATH_STAGING || '/var/opt/millegrilles/consignation/staging/landing'

    const fichiersMiddleware = new FichiersMiddleware(mq, {PATH_STAGING})
    const fichiersTransfertUpstream = new FichiersTransfertUpstream(mq, {PATH_STAGING})

    const router = express.Router()
    
    router.use((req, res, next)=>{
      req.fichiersMiddleware = fichiersMiddleware
      req.fichiersTransfert = fichiersTransfertUpstream

      debug("routesPubliques REQ url ", req.url)

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
    const body = req.body,
          headers = req.headers
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
      if( ! extensions.roles.includes('landing_web') ) return res.status(403).send({ok: false, err: 'Invalid token - cert role not allowed'})
  
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
      if(actif !== true) return res.status(403).send({ok: false, err: 'Application inactive'})

      // Creer transaction
      const transaction = await formatterTransactionMessagerie(mq, infoApplication, message, {uuid_transaction, headers})
      debug("Message usager application ", transaction)

      // Preparer batch fichiers
      let fichiersPresents = false
      try {
          debug("submitForm Uploader fichiers")
          const pathSource = fichiersMiddleware.getPathBatch(uuid_transaction)
          await fichiersTransfert.takeTransfertBatch(uuid_transaction, pathSource)
          fichiersPresents = true
      } catch(err) {
        if(err.code === 'ENOENT') {
          debug("Aucuns fichiers a uploader")
        } else {
          // Autre erreur
          throw err
        }
      }

      const attachements = { cle: transaction.cle }
      delete transaction.cle
      // Soumettre la transaction
      const reponse = await mq.transmettreCommande(
        'Messagerie', transaction, 
        {action: 'notifier', attachements, ajouterCertificat: true, exchange: '1.public'}
      )
      debug("Reponse notifier : ", reponse)

      // Ajouter cle dans redis pour bloquer reutilisation du token
      const ttl = expirationToken - Math.round(new Date().getTime()/1000) + 1
      redisClient.set(cleRedisSubmit, '1', {NX: true, EX: ttl})
        .catch(err=>console.error(new Date() + " ERROR submitForm Erreur sauvegarde cle redis submit " + cleRedisSubmit + " : " + err))
  
      // Declencher le transfert de fichiers
      if(fichiersPresents) {
        debug("Debut transfert fichiers")
        fichiersTransfert.ajouterFichierConsignation(uuid_transaction)
      }

      return res.status(201).send({ok: true, message_id: transaction.id, uuid_transaction})
    } catch(err) {
      console.error(new Date() + ' ERROR submitForm ', err)
      return res.sendStatus(500)
    }
  
}

/**
 * Genere un message inter-millegrilles (kind:8) avec l'information recue.
 * @param {*} mq 
 * @param {*} infoApplication 
 * @param {*} message 
 * @param {*} opts 
 * @returns 
 */
async function formatterTransactionMessagerie(mq, infoApplication, message, opts) {
  opts = opts || {}

  const { application_id, user_id } = infoApplication
  const domaine = opts.domaine || 'Messagerie',
        action = opts.action || 'nouveauMessage'

  debug("Application Id : %s, user_id : %s", application_id, user_id)

  // Preparer information message inter-millegrilles
  const { commandeMaitrecles, contenu } = message
  const partition = commandeMaitrecles.partition
  delete commandeMaitrecles.partition
  commandeMaitrecles.domaine = domaine  // Override domaine
  commandeMaitrecles.identificateurs_document = {'landing': 'true'}

  const dechiffrage = {
      format: commandeMaitrecles.format,
      header: commandeMaitrecles.header,
      hachage: commandeMaitrecles['hachage_bytes'],
  }

  // Signer message
  const messageSigne = await mq.pki.formatterMessage(
    MESSAGE_KINDS.KIND_COMMANDE_INTER_MILLEGRILLE, contenu, 
    {domaine, action, dechiffrage, ajouterCertificat: true}
  )
  debug("Message signe : ", messageSigne)
  commandeMaitrecles.identificateurs_document.message_id = messageSigne.id
  // Cleanup certificats - ils vont etre ajoutes au besoin dans la commande notifier
  delete messageSigne.certificat
  delete messageSigne.millegrille

  const commandeMaitreclesSignee = await mq.pki.formatterMessage(
    MESSAGE_KINDS.KIND_COMMANDE, commandeMaitrecles, 
    {domaine: 'MaitreDesCles', action: 'sauvegarderCle', ajouterCertificat: true}
  )
  // Attacher partition pour la commande de maitre des cles
  commandeMaitreclesSignee.attachements = {partition}

  // messageSigne.attachements = {
  //   'cle': commandeMaitreclesSignee
  // }

  const transaction = {
    message: messageSigne,
    destinataires: [user_id],
    // expiration: 30 * 86400,
    // niveau: 'info',
    cle: commandeMaitreclesSignee,
  }

  return transaction
}

// Router /landing/fichiers
function routerFichiers(fichiersMiddleware) {
  const router = express.Router()

  router.put('/:correlation/:position', fichiersMiddleware.middlewareRecevoirFichier())
  router.post('/:correlation', 
    express.json(), 
    fichiersMiddleware.middlewareReadyFichier({signerCommandes: true, passthroughOnSuccess: true}),
    fichierReadyOk
  )

  const deleteHandler = fichiersMiddleware.middlewareDeleteStaging()
  router.delete('/:correlation', deleteHandler)
  router.delete(deleteHandler)

  return router
}

function fichierReadyOk(req, res) {
  // res.setHeader('access-control-allow-origin', '*')
  res.status(200)
  res.send({ok: true})
}
