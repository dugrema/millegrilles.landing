import { verifierToken } from './landing.js'

const debug = require('debug')('routes:messagerieFichiers')
const express = require('express')
const bodyParser = require('body-parser')

function init(amqpdao, backingStore, opts) {
    opts = opts || {}

    const route = express.Router()

    // Verifier du token JWT
    route.use(verifierToken)

    // Reception fichiers (PUT)
    const middlewareRecevoirFichier = backingStore.middlewareRecevoirFichier(opts)
    route.put('/upload/:correlation/:position', middlewareRecevoirFichier)

    // Verification fichiers (POST)
    const middlewareReadyFichier = backingStore.middlewareReadyFichier(amqpdao, opts)
    route.post('/upload/:correlation', bodyParser.json(), middlewareReadyFichier)

    // Cleanup
    const middlewareDeleteStaging = backingStore.middlewareDeleteStaging(opts)
    route.delete('/upload/:correlation', middlewareDeleteStaging)

    debug("Route /messagerie/upload initialisee")
    
    return route
}

module.exports = init
