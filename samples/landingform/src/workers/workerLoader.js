import { wrap, releaseProxy } from 'comlink'

class ConfigDao {
  constructor(chiffrage) {
    this.chiffrage = chiffrage

    this.config = null
    this.fiche = null
    this.contenuFiche = null
    this.location = null
  }
  
  setConfig(config) {
    this.config = config
    this.location = new URL(config.fiche_url)
  }
  
  async reload() {
    if(!this.location) throw new Error('config non initialisee ou invalide')
    const fiche = await loadFiche(this.location.href)
    this.fiche = fiche
    this.contenuFiche = JSON.parse(fiche.contenu)
    return this.fiche
  }

  getClesChiffrage() {
    return this.contenuFiche.chiffrage
  }

  getConfig() {
    return this.config
  }

  getContenuFiche() {
    return this.contenuFiche || {}
  }

  getUrlsApplication() {
    let urlLocal = null
    const hostnameLocal = window.location.hostname
    
    const appUrls = this.contenuFiche.applications.landing_web
      .filter(item=>item.nature === 'dns')
      .map(item=>{
        const url = new URL(item.url)
        if(url.hostname === hostnameLocal) urlLocal = url  // Conserver lien vers hostname courant
        return url
      })

    // Retourner url de l'application courante de preference
    if(urlLocal) return [urlLocal]

    return appUrls
  }

  clear() {
    this.fiche = null
    this.contenuFiche = null
  }
}

// Exemple de loader pour web workers
export function setupWorkers() {

  // Chiffrage et x509 sont combines, reduit taille de l'application
  const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))

  // Pseudo worker
  const configDao = new ConfigDao(chiffrage)

  const workerInstances = { chiffrage }

  const workers = Object.keys(workerInstances).reduce((acc, item)=>{
    acc[item] = workerInstances[item].proxy
    return acc
  }, {})

  workers.config = configDao

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
        console.debug("Resultat validation fiche %s, IDMG calcule %s", resultat, idmgCalcule)
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

async function loadConfiguration() {
  try {
    const location = new URL(window.location.href)
    location.pathname = location.pathname + '/config.json'
    const axiosImport = await import('axios')
    const axios = axiosImport.default
    const reponse = await axios.get(location.href)
    const config = reponse.data || {}
    console.debug("Configuration chargee ", config)
    return config
  } catch(err) {
    console.error("Erreur chargement fiche systeme : %O", err)
  }
}

async function loadFiche(urlFiche) {
  try {
    const axiosImport = await import('axios')
    const axios = axiosImport.default
    const reponse = await axios.get(urlFiche)
    const fiche = reponse.data || {}
    console.debug("loadFiche ", fiche)
    return fiche
  } catch(err) {
    console.error("Erreur chargement fiche systeme : %O", err)
  }
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
