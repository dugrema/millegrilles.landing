import { wrap, releaseProxy } from 'comlink'
import { usagerDao } from '@dugrema/millegrilles.reactjs'

// import clesDao from '../redux/clesDao'

// Exemple de loader pour web workers
export function setupWorkers() {

  // Chiffrage et x509 sont combines, reduit taille de l'application
  const connexion = wrapWorker(new Worker(new URL('./connexion.worker', import.meta.url), {type: 'module'}))
  const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))

  const workerInstances = { chiffrage, connexion }

  const workers = Object.keys(workerInstances).reduce((acc, item)=>{
    acc[item] = workerInstances[item].proxy
    return acc
  }, {})
  
  // Pseudo-worker
  workers.usagerDao = usagerDao                   // IDB usager
  // workers.clesDao = clesDao(workers)              // Cles asymetriques
  
  const ready = wireWorkers(workers)
  
  // const location = new URL(window.location)
  // location.pathname = '/fiche.json'

  // import('axios')
  //   .then(axiosImport=>{
  //       const axios = axiosImport.default
  //       console.debug("Axios : ", axios)
  //       return axios.get(location.href)
  //     })
  //   .then(reponse=>{
  //     const fiche = reponse.data || {}
  //     const ca = fiche.ca
  //     if(ca) {
  //       return connexion.proxy.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false})
  //     }
  //   })
  //   .catch(err=>{
  //     console.error("Erreur chargement fiche systeme : %O", err)
  //   })

    return { workerInstances, workers, ready }
}

function wrapWorker(worker) {
  const proxy = wrap(worker)
  return {proxy, worker}
}

async function wireWorkers(workers) {
  const { connexion, chiffrage } = workers

  const location = new URL(window.location)
  location.pathname = '/fiche.json'
  // console.debug("Charger fiche ", location.href)

  const axiosImport = await import('axios')
  const axios = axiosImport.default
  const reponse = await axios.get(location.href)
  console.debug("Reponse fiche ", reponse)
  const data = reponse.data || {}
  const fiche = JSON.parse(data.contenu)
  const ca = fiche.ca
  if(ca) {
      // console.debug("initialiserCertificateStore (connexion, chiffrage)")
      await Promise.all([
          connexion.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false}),
          chiffrage.initialiserCertificateStore(ca, {isPEM: true, DEBUG: false})
      ])
  } else {
      throw new Error("Erreur initialisation - fiche/CA non disponible")
  }
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
