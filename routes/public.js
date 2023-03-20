import debugLib from 'debug'
import express from 'express'
import { signerTokenApplication, verifierTokenApplication } from '@dugrema/millegrilles.nodejs/src/jwt.js'
import { v4 as uuidv4 } from 'uuid'

const debug = debugLib('landing:public')

// Routes publiques
function routesPubliques() {
    const router = express.Router()
 
    //router.use(protectionPublique)
    router.get('/token', getToken)
    router.post('/submit', express.json(), verifierToken, submitForm)
  
    return router
}

export default routesPubliques
  
// /** Compteur par adresse IP source pour eviter attaques */
// function protectionPublique(req, res, next) {
  
//     const publicIp = req.ip
//     debug("protectionPublique ip : %s", publicIp)
//     // TODO : ajouter IP a redis, verifier si compte est depasse (voir messagerie upload)  
  
//     next()
// }

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
  
export async function verifierToken(req, res, next) {
    const mq = req.amqpdao
    const body = req.body || {}
    try {
        const token = body.token || req.headers['x-token-jwt']
        var tokenInfo = await verifierTokenApplication(mq.pki, token)
        res.token = tokenInfo
        next()
    } catch(err) {
        console.error(new Date() + " ERROR landingFichiers Erreur token : ", err)
        return res.sendStatus(401)
    }
}
  
async function submitForm(req, res) {
    const mq = req.amqpdao
    const body = req.body
    debug("Submit form req :\n", body)
  
    // S'assurer que le message est recu cross-origin
    // res.append('Access-Control-Allow-Origin', '*')
  
    // Verifier le token JWT
    const { message } = body
  
    if(!message) return res.status(400).send({ok: false, err: 'Message missing'})
  
    try {
      const tokenInfo = res.token
      if(!tokenInfo) {
        return res.status(401).send({ok: false, err: "Missing token"})
      }
      debug("Token Info : ", tokenInfo)
      const { extensions, payload } = tokenInfo
      if( ! extensions.roles.includes('landing_web') ) return res.status(403).send({ok: false, err: 'Invalid cert role'})
  
      const { application_id, sub: uuid_transaction} = payload
      debug("Application Id : %s, uuid_transaction : %s", application_id, uuid_transaction)
  
      // Charger configuration application
      const infoApplication = await mq.transmettreRequete('Landing', {application_id}, {action: 'getApplication', exchange: '2.prive'})
      debug("Info application ", infoApplication)
      const { user_id, actif } = infoApplication
      if(actif !== true) return res.status(503).send({ok: false, err: 'Application inactive'})
  
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
  
      console.debug("Transaction ", transaction)
  
      const reponse = await mq.transmettreCommande('Messagerie', transaction, {action: 'recevoir', ajouterCertificat: true})
      debug("Reponse recevoir : ", reponse)
  
      return res.status(201).send({ok: true, uuid_transaction})
    } catch(err) {
      console.error(new Date() + ' ERROR submitForm ', err)
      return res.sendStatus(500)
    }
  
}
  