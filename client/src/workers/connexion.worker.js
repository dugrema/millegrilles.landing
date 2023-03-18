import { expose } from 'comlink'
import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'

const CONST_DOMAINE_LANDING = 'Landing'

function getListeApplications(requete) {
  requete = requete || {}
  return ConnexionClient.emitBlocking(
    'getListeApplications', 
    requete, 
    {
      domaine: CONST_DOMAINE_LANDING, 
      action: 'getListeApplications', 
      ajouterCertificat: true,
    }
  )
}

function getApplication(applicationId) {
  return ConnexionClient.emitBlocking(
    'getApplication', 
    {application_id: applicationId}, 
    {
      domaine: CONST_DOMAINE_LANDING, 
      action: 'getApplication', 
      ajouterCertificat: true,
    }
  )
}

function creerNouvelleApplication() {
  return ConnexionClient.emitBlocking(
    'creerNouvelleApplication', 
    {}, 
    {
      domaine: CONST_DOMAINE_LANDING, 
      action: 'creerNouvelleApplication', 
      ajouterCertificat: true,
    }
  )
}

function sauvegarderApplication(application) {
  return ConnexionClient.emitBlocking(
    'sauvegarderApplication', 
    application, 
    {
      domaine: CONST_DOMAINE_LANDING, 
      action: 'sauvegarderApplication', 
      ajouterCertificat: true,
    }
  )
}

// Evenements

// async function ecouterEvenementsCategoriesUsager(cb) {
//   return ConnexionClient.subscribe('ecouterEvenementsCategoriesUsager', cb, {}) 
// }

// async function retirerEvenementsCategoriesUsager(cb) {
//   return ConnexionClient.unsubscribe('retirerEvenementsCategoriesUsager', cb, {}) 
// }

// Exposer methodes du Worker
expose({
    ...ConnexionClient, 

    // Requetes et commandes privees
    getListeApplications, getApplication, 
    creerNouvelleApplication, sauvegarderApplication,

    // Event listeners proteges
    
})
