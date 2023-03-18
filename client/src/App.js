import { lazy, Suspense, useState, useMemo, useCallback, useEffect } from 'react'
// import { Provider as ReduxProvider, useDispatch } from 'react-redux'
import { proxy as comlinkProxy } from 'comlink'

import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { LayoutMillegrilles, ModalErreur, Menu as MenuMillegrilles, DropDownLanguage, ModalInfo } from '@dugrema/millegrilles.reactjs'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, {useEtatPret, useEtatConnexion, WorkerProvider, useUsager, useFormatteurPret, useInfoConnexion} from './WorkerContext'

import { useTranslation } from 'react-i18next'
import './i18n'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'
import 'react-quill/dist/quill.snow.css'
import '@dugrema/millegrilles.reactjs/dist/index.css'

import manifest from './manifest.build'

import './index.scss'
import './App.css'

const Accueil = lazy( () => import('./Accueil') )
const ListeApplications = lazy( () => import('./ListeApplications') )
const ConfigurerApplication = lazy( () => import('./ConfigurerApplication') )

function App() {
  
  return (
    <WorkerProvider attente={<Attente />}>
      <ErrorBoundary>
        <Suspense fallback={<Attente />}>
          <LayoutMain />
        </Suspense>
      </ErrorBoundary>
    </WorkerProvider>
  )

}
export default App

// function ProviderReduxLayer() {

//   const workers = useWorkers()
//   const store = useMemo(()=>{
//     if(!workers) return
//     return storeSetup(workers)
//   }, [workers])

//   return (
//     <ReduxProvider store={store}>
//         <LayoutMain />
//     </ReduxProvider>
//   )
// }

function LayoutMain(props) {

  const { i18n, t } = useTranslation()

  const workers = useWorkers()
  // const dispatch = useDispatch()
  const usager = useUsager()
  const etatConnexion = useEtatConnexion()
  const etatFormatteurMessage = useFormatteurPret()
  const infoConnexion = useInfoConnexion()

  const [sectionAfficher, setSectionAfficher] = useState('')
  const [erreur, setErreur] = useState('')
  
  const handlerCloseErreur = () => setErreur(false)

  const etatAuthentifie = usager && etatFormatteurMessage

  const estProprietaire = useMemo(()=>{
    if(!usager) return [null, null]
    const extensions = usager.extensions
    return extensions.delegationGlobale === 'proprietaire'
  }, [usager])

  // Setup userId dans redux
  // useEffect(()=>{
  //   if(!usager) return
  //   const userId = usager.extensions.userId
  //   dispatch(setUserIdCategories(userId))
  //   dispatch(setUserIdGroupes(userId))
  // }, [dispatch, usager])

  const menu = (
    <MenuApp 
        i18n={i18n} 
        estProprietaire={estProprietaire}
        setSectionAfficher={setSectionAfficher} />
  ) 

  return (
      <LayoutMillegrilles menu={menu}>

          <Container className="contenu">

              <Suspense fallback={<Attente workers={workers} idinfoConnexionmg={infoConnexion} etatConnexion={etatAuthentifie} />}>
                <ApplicationLanding 
                    workers={workers}
                    usager={usager}
                    etatAuthentifie={etatAuthentifie}
                    etatConnexion={etatConnexion}
                    infoConnexion={infoConnexion}
                    sectionAfficher={sectionAfficher}
                    setSectionAfficher={setSectionAfficher}
                  />
              </Suspense>

          </Container>

          <ModalErreur show={!!erreur} err={erreur.err} message={erreur.message} titre={t('Erreur.titre')} fermer={handlerCloseErreur} />

      </LayoutMillegrilles>
  )  

}

function ApplicationLanding(props) {

  const { sectionAfficher, setSectionAfficher} = props

  const workers = useWorkers()
  // const dispatch = useDispatch()
  const etatPret = useEtatPret()
  const usager = useUsager()

  const [applicationId, setApplicationId] = useState('')

  // const categoriesMajHandler = useCallback(comlinkProxy(message => {
  //   dispatch(categoriesMergeItems(message.message))
  // }), [dispatch])

  // const groupesMajHandler = useCallback(comlinkProxy(message => {
  //   // dispatch(groupesMergeItems(message.message))
  //   dispatch(thunksGroupes.recevoirGroupe(workers, message.message))
  // }), [dispatch])

  // useEffect(()=>{
  //   if(!etatPret || !usager) return

  //   const userId = usager.extensions.userId
  //   dispatch(setUserIdCategories(userId))
  //   dispatch(setUserIdGroupes(userId))

  //   // S'assurer d'avoir les categories les plus recentes
  //   dispatch(thunksCategories.rafraichirCategories(workers))
  //     .catch(err=>console.error("Erreur chargement categories ", err))

  //   dispatch(thunksGroupes.rafraichirGroupes(workers))
  //     .catch(err=>console.error("Erreur chargement groupes", err))

  //   workers.connexion.ecouterEvenementsGroupesUsager(groupesMajHandler)
  //     .catch(err=>console.error("Erreur ecouterEvenementsGroupesUsager ", err))

  //   workers.connexion.ecouterEvenementsCategoriesUsager(categoriesMajHandler)
  //     .catch(err=>console.error("Erreur ecouterEvenementsCategoriesUsager ", err))

  //   return () => { 
  //     workers.connexion.retirerEvenementsGroupesUsager()
  //       .catch(err=>console.warn("Erreur retrait listener groupes ", err))
  //     workers.connexion.retirerEvenementsCategoriesUsager()
  //       .catch(err=>console.warn("Erreur retrait listener categories ", err))
  //   }
  // }, [workers, dispatch, etatPret, usager, categoriesMajHandler, groupesMajHandler])

  let Page = null
  if(applicationId) {
    Page = ConfigurerApplication
  } else {
    switch(sectionAfficher) {
      case 'ListeApplications': Page = ListeApplications; break
      default:
        Page = Accueil
    }
  }

  return (
    <Container className="main-body">
      <Page 
        setSectionAfficher={setSectionAfficher} 
        applicationId={applicationId}
        setApplicationId={setApplicationId} />
    </Container>
  )

}

function MenuApp(props) {

  const { i18n, setSectionAfficher, estProprietaire } = props

  const infoConnexion = useInfoConnexion()
  const usager = useUsager()
  const etatConnexion = useEtatConnexion()

  const idmg = useMemo(()=>{
    if(!infoConnexion) return null
    return infoConnexion.idmg
  }, [infoConnexion])

  const { t } = useTranslation()
  const [showModalInfo, setShowModalInfo] = useState(false)
  const handlerCloseModalInfo = useCallback(()=>setShowModalInfo(false), [setShowModalInfo])

  const deconnecterHandler = useCallback(()=>{
    // Supprimer les cles, contenu dechiffre
    Promise.resolve()
      .then(async ()=>{
        //await clearContenuDechiffre()
      })
      .catch(err=>console.error('Erreur cleanup ', err))
      .finally(()=>{
        window.location = '/millegrilles/authentification/fermer'
      })
  }, [])

  const handlerSelect = useCallback(eventKey => {
      switch(eventKey) {
        case 'listeApplications': setSectionAfficher('ListeApplications'); break
        case 'configurerApplication': setSectionAfficher('ConfigurerApplication'); break
        case 'portail': window.location = '/millegrilles'; break
        case 'deconnecter': deconnecterHandler(); break
        case 'information': setShowModalInfo(true); break
        default:
          setSectionAfficher('')
      }
  }, [setSectionAfficher, setShowModalInfo])

  const handlerChangerLangue = eventKey => {i18n.changeLanguage(eventKey)}
  const brand = (
      <Navbar.Brand>
          <Nav.Link onClick={handlerSelect} title={t('titre')}>
              {t('titre')}
          </Nav.Link>
      </Navbar.Brand>
  )

  return (
      <>
          <MenuMillegrilles brand={brand} labelMenu="Menu" etatConnexion={etatConnexion} onSelect={handlerSelect}>

            <Nav.Link eventKey="listeApplications" title={t('menu.listeApplications')}>
                {t('menu.listeApplications')}
            </Nav.Link>

            {/* <Nav.Link eventKey="categories" title={t('menu.categories')}>
                {t('menu.categories')}
            </Nav.Link> */}

            <Nav.Link eventKey="information" title="Afficher l'information systeme">
                {t('menu.information')}
            </Nav.Link>

            <DropDownLanguage title={t('menu.language')} onSelect={handlerChangerLangue}>
                <NavDropdown.Item eventKey="en-US">English</NavDropdown.Item>
                <NavDropdown.Item eventKey="fr-CA">Francais</NavDropdown.Item>
            </DropDownLanguage>

            <Nav.Link eventKey="portail" title={t('menu.portail')}>
                {t('menu.portail')}
            </Nav.Link>

            <Nav.Link eventKey="deconnecter" title={t('menu.deconnecter')}>
                {t('menu.deconnecter')}
            </Nav.Link>

          </MenuMillegrilles>

          <ModalInfo 
              show={showModalInfo} 
              fermer={handlerCloseModalInfo} 
              manifest={manifest} 
              idmg={idmg} 
              usager={usager} />
      </>
  )
}

function Attente(_props) {
  return (
      <div>
          <p className="titleinit">Preparation de l'application Landing</p>
          <p>Veuillez patienter durant le chargement de la page.</p>
          <ol>
              <li>Initialisation</li>
              <li>Chargement des composants dynamiques</li>
              <li>Connexion a la page</li>
          </ol>
      </div>
  )
}
