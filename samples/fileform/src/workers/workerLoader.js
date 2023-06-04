import { wrap, releaseProxy } from 'comlink'

import { loadConfiguration, ConfigDao } from '@dugrema/millegrilles.reactjs/src/landing.js'

import * as uploadFichiersDao from '../redux/uploaderIdbDao'
import setupTraitementFichiers from './traitementFichiers'

// Exemple de loader pour web workers
export function setupWorkers() {

  // Chiffrage et x509 sont combines, reduit taille de l'application
  const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))
  const transfertFichiers = wrapWorker(new Worker(new URL('./transfert.worker', import.meta.url), {type: 'module'}))

  // Pseudo worker
  const configDao = new ConfigDao(chiffrage)

  const workerInstances = { chiffrage, transfertFichiers }

  const workers = Object.keys(workerInstances).reduce((acc, item)=>{
    acc[item] = workerInstances[item].proxy
    return acc
  }, {})

  // Pseudo-worker
  workers.config = configDao
  workers.uploadFichiersDao = uploadFichiersDao      // IDB upload fichiers
  workers.traitementFichiers = setupTraitementFichiers(workers) // Upload et download

  // const configPromise = loadConfiguration()
  //   .then(async config=>{
  //     configDao.setConfig(config)
  //     const fiche = await configDao.reload()
  //     const ca = fiche.ca || fiche['millegrille']
  //     if(ca) {
  //       await chiffrage.proxy.init(ca)  // x509client
  //       await chiffrage.proxy.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false})  // chiffrage
  //       // await transfertFichiers.proxy.up_setCertificatCa(ca)  //  Note : pas necessaire, cles secrets chiffrages via contenu message

  //       // Valider message
  //       const idmgCalcule = await chiffrage.proxy.getIdmgLocal()
  //       if(config.idmg && config.idmg != idmgCalcule) throw new Error("IDMG mismatch")
  //       const resultat = await chiffrage.proxy.verifierMessage(fiche)
  //       console.debug("Resultat validation fiche %s, IDMG calcule %s", resultat, idmgCalcule)
  //     } else {
  //       throw new Error("Certificat CA manquant de la fiche")
  //     }

  //     return true
  //   })
  //   .catch(err=>{
  //     console.error("Erreur chargement config / fiche / chiffrage worker ", err)
  //   })
  
  const configPromise = loadConfiguration()
    .then(async config=>{
      configDao.setConfig(config)
      const fiche = await configDao.reload()
      const contenuFiche = configDao.getContenuFiche()
      const ca = contenuFiche.ca || fiche['millegrille']
      if(ca) {
        await chiffrage.proxy.init(ca)  // x509client
        await chiffrage.proxy.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false})  // chiffrage
        
        // Valider message
        const idmgCalcule = await chiffrage.proxy.getIdmgLocal()
        if(contenuFiche.idmg && contenuFiche.idmg !== idmgCalcule) throw new Error("IDMG mismatch")
        const resultat = await chiffrage.proxy.verifierMessage(fiche)
        console.info("Resultat validation fiche %s, IDMG calcule %s", resultat, idmgCalcule)
      } else {
        throw new Error("Certificat CA manquant de la fiche")
      }

      return true
    })
    .catch(err=>{
      console.error("Erreur chargement config / fiche / chiffrage worker ", err)
      configDao.clear()
    })
  

  return { workerInstances, workers, ready: configPromise }
}

function wrapWorker(worker) {
  const proxy = wrap(worker)
  return {proxy, worker}
}

export function cleanupWorkers(workers) {
  Object.values(workers).forEach((workerInstance) => {
    try {
      const {worker, proxy} = workerInstance
      proxy[releaseProxy]()
      worker.terminate()
    } catch(err) {
      console.warn("Errreur fermeture worker : %O\n(Workers: %O)", err, workers)
    }
  })
}
