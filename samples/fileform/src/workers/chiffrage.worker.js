import { expose } from 'comlink'
import * as ChiffrageClient from '@dugrema/millegrilles.reactjs/src/chiffrageClient'
import * as X509Client from '@dugrema/millegrilles.reactjs/src/x509Client'

expose({
    ...ChiffrageClient,
    ...X509Client,
})
