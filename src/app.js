import debugLib from 'debug'
import express from 'express'

import server6 from '@dugrema/millegrilles.nodejs/src/server6.js'
import forgecommon from '@dugrema/millegrilles.utiljs/src/forgecommon.js'

import { configurerEvenements } from './appSocketIo.js'
import routeLanding from '../routes/landing.js'
import * as mqdao from './mqdao.js'

const debug = debugLib('app')
const { extraireExtensionsMillegrille } = forgecommon

export default async function app(params) {
    debug("Server app params %O", params)
    const app = express()
    const {server, socketIo, amqpdao: amqpdaoInst} = await server6(
        app,
        configurerEvenements,
        {pathApp: '/landing', verifierAutorisation, exchange: '2.prive'}
    )

    socketIo.use((socket, next)=>{
      socket.mqdao = mqdao
      next()
    })

    // Inserer les routes apres l'initialisation, permet d'avoir le middleware
    // attache avant (app.use comme le logging morgan, injection amqpdao, etc.)
    const route = express.Router()
    app.use('/landing', route)
    route.use((req, res, next)=>{
      debug("app : %s", req.url)
      req.mqdao = mqdao
      next()
    })
    route.use(routeLanding(amqpdaoInst))

    return server
}

function verifierAutorisation(socket, securite, certificatForge) {

    let prive = false, protege = false

    const extensions = extraireExtensionsMillegrille(certificatForge)

    if(['proprietaire', 'delegue'].includes(extensions.delegationGlobale)) {
        // Deleguation globale donne tous les acces
        debug("Usager proprietaire, acces protege OK")
        prive = true
        protege = true
    } 
   
    return {prive, protege}
}

