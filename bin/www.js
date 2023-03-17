#!/usr/bin/env node

import debugLib from 'debug'
import app from '../src/app.js'

const debug = debugLib('www')
debug("Demarrer server6")

// Initialiser le serveur
app()
    .catch(err=>{
        console.error("serveur6.www Erreur execution app : %O", err)
    })
    .finally(()=>{
        debug("Fin initialisation serveur6.www")
    })
