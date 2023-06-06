import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { proxy as comlinkProxy } from 'comlink'
import { useSelector, useDispatch } from 'react-redux'

// Imports landing
import { ErrorBoundary, landingReact } from '@dugrema/millegrilles.reactjs'
import { getToken, submitHtmlForm, preparerFichiersBatch } from '@dugrema/millegrilles.reactjs/src/landing/landing.js'
import { setToken, clearToken, clearUploadsState, setBatchUpload } from '@dugrema/millegrilles.reactjs/src/landing/uploaderSlice'
import { chargerUploads } from '@dugrema/millegrilles.reactjs/src/landing/uploaderIdbDao'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'

import useWorkers, { WorkerProvider, useEtatPret, useUrlConnexion, useConfig } from './WorkerContext'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'

import './App.css'

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

function LayoutMain(props) {

  const workers = useWorkers()
  const etatPret = useEtatPret()
  const urlConnexion = useUrlConnexion()
  const config = useConfig()
  const dispatch = useDispatch()

  const token = useSelector(state=>state.uploader.token)
  const batchId = useSelector(state=>state.uploader.batchId)

  const [submitEtat, setSubmitEtat] = useState('')

  const tokenFormatte = useMemo(()=>{
    if(!token) return ''
    return token.replaceAll('\.', '\. ')
  }, [token])

  const nouveauHandler = useCallback(()=>{
    dispatch(clearUploadsState())
    dispatch(clearToken())
    
    setSubmitEtat(false)
    
    window.localStorage.removeItem('token')
    window.localStorage.removeItem('batchId')

    workers.uploadFichiersDao.clear()
      .catch(err=>console.error("Erreur suppression fichiers upload : ", err))
  }, [workers, dispatch, setSubmitEtat])

  useEffect(()=>{
    if(submitEtat === true || token || !config) return  // Rien a faire

    // Verifier si on charge avec localStorage
    let tokenStorage = window.localStorage.getItem('token')
    let batchId = window.localStorage.getItem('batchId')
    console.debug("LayoutMain localStorage batch id %s\nToken: %s", batchId, tokenStorage)
    if(tokenStorage && batchId) {
      console.debug("LayoutMain reutiliser batchId %s", batchId)
      dispatch(setToken({token: tokenStorage, batchId}))

      // Recharger les fichiers deja uploades
      workers.uploadFichiersDao.chargerUploads(batchId)
        .then(uploads=>{
          console.debug("Uploads existants ", uploads)
          dispatch(setBatchUpload(uploads))
        })
        .catch(err=>console.error("Erreur chargement fichiers existants : ", err))

    } else {
      console.debug("LayoutMain Demander nouveau token")
      getToken(config, {urlConnexion})
        .then(data=>{
          console.debug("Token data ", data)
          dispatch(setToken({token: data.token, batchId: data.uuid_transaction}))
          
          console.debug("Store token/batchId dans localStorage")
          window.localStorage.setItem('token', data.token)
          window.localStorage.setItem('batchId', data.uuid_transaction)
        })
        .catch(err=>console.error("Erreur chargement token ", err))
      }
  }, [dispatch, config, urlConnexion, token, submitEtat])

  useEffect(()=>{
    const urlUpload = urlConnexion + '/public/fichiers'
    console.debug("!Update path serveur pour upload fichiers : %s ", urlUpload)
    workers.transfertFichiers.up_setPathServeur(urlUpload)
      .catch(err=>console.error("Erreur changement URL connexion pour upload", err))
  }, [workers, urlConnexion])

  useEffect(()=>{
    if(submitEtat === true) {
      // Clear database
      workers.uploadFichiersDao.clear()
        .catch(err=>console.error("Erreur suppression fichiers upload : ", err))
      window.localStorage.removeItem('token')
      window.localStorage.removeItem('batchId')
    }
  }, [workers, submitEtat])

  return (
    <Container>
      <h1>Sample form 1</h1>
      <Alert variant='info'>
        <Alert.Heading>Information backend</Alert.Heading>
        <p>Application Id : {config.application_id}</p>
        <p>URL connexion : {urlConnexion}</p>
        <p>Etat pret : {etatPret?'Oui':'Non'}</p>
        <p>Batch Id : {batchId}</p>
        <div>
          <div>Token session</div>
          <div style={{'fontSize': 'x-small'}}>{tokenFormatte}</div>
        </div>
      </Alert>

      {submitEtat===true?
        <SubmitOk nouveau={nouveauHandler} />
      :
        <FormApplication setSubmitEtat={setSubmitEtat} clear={nouveauHandler} />
      }


    </Container>
  )
}

function Attente(props) {
  return <p>Chargement en cours</p>
}

function FormApplication(props) {

  const { setSubmitEtat, clear } = props

  const token = useSelector(state=>state.uploader.token)
  const batchId = useSelector(state=>state.uploader.batchId)
  const progres = useSelector(state=>state.uploader.progres)
  const uploadActif = useSelector(state=>state.uploader.uploadActif)
  const liste = useSelector(state=>state.uploader.listeBatch)

  const workers = useWorkers(),
        dispatch = useDispatch(),
        urlConnexion = useUrlConnexion(),
        config = useConfig()

  const [champ1, setChamp1] = useState('')
  const [ preparationUploadEnCours, setPreparationUploadEnCours ] = useState(false)

  const signalAnnuler = useMemo(()=>{
    let valeur = false
    return {
        setValeur: v => { valeur = v },
        signal: comlinkProxy(() => valeur)
    }
  }, [])

  const transfertEnCours = useMemo(()=>{
    if(progres || uploadActif) return true
    return false
  }, [progres, preparationUploadEnCours])

  const clearHandler = useCallback(()=>{
    setChamp1('')
    window.localStorage.removeItem('champ1')
    clear()
  }, [clear, setChamp1])

  const champ1ChangeHandler = useCallback(e=>{
    const value = e.currentTarget.value
    setChamp1(value)
    window.localStorage.setItem('champ1', value)
  }, [setChamp1])

  const submitHandler = useCallback( e => {
    e.preventDefault()
    e.stopPropagation()

    chargerUploads(batchId)
      .then(async fichiersBatch => {
        const fichiers = await preparerFichiersBatch(fichiersBatch)
        console.debug("Fichiers : ", fichiers)
        const contenu = formatterMessage(champ1)
        const certificats = workers.config.getClesChiffrage()

        console.debug("Submit %O, certificats %O", contenu, certificats)
        const r = await submitForm(urlConnexion, workers, contenu, token, certificats, {application_id: config.application_id, fichiers})
        console.debug("Reponse submit ", r)
        setSubmitEtat(true)
        dispatch(clearToken())

        // Clear champs
        window.localStorage.removeItem('champ1')
      })
      .catch(err=>console.error("Erreur submit form ", err))
  }, [dispatch, batchId, urlConnexion, workers, config, champ1, token, setSubmitEtat])

  useEffect(()=>{
    // Charger champs persistes
    setChamp1(window.localStorage.getItem('champ1') || '')
  }, [setChamp1])

  return (
    <div>
      <h2>Form</h2>

      <Form.Group as={Row} controlId="champ1">
        <Form.Label column sm={4} md={2}>Champ 1</Form.Label>
        <Col>
            <Form.Control value={champ1} onChange={champ1ChangeHandler} />
        </Col>
      </Form.Group>

      <h3>Fichiers</h3>

      <Row>
        <Col>
          <landingReact.BoutonUpload 
            traitementFichiers={workers.traitementFichiers}
            dispatch={dispatch}
            setPreparationUploadEnCours={setPreparationUploadEnCours} 
            signalAnnuler={signalAnnuler.signal}
            token={token}
            batchId={batchId}>
            <i className="fa fa-plus"/> Fichier
          </landingReact.BoutonUpload>
        </Col>
      </Row>

      <br/>

      <landingReact.ProgresUpload 
        dispatch={dispatch} progres={progres} preparation={preparationUploadEnCours} 
        actif={uploadActif}
        />

      <br/>

      <ListeFichiers fichiers={liste} />

      <Row>
        <Col>
          <Button onClick={submitHandler} disabled={transfertEnCours}>Submit</Button>
          <Button variant="secondary" onClick={clearHandler} disabled={transfertEnCours}>Annuler</Button>
        </Col>
      </Row>

    </div>
  )
}

function SubmitOk(props) {

  const { nouveau } = props

  const workers = useWorkers()  

  const nouveauHandler = useCallback(()=>{
    nouveau()
  }, [nouveau])

  return (
    <Alert variant='success'>
      <Alert.Heading>Message envoye</Alert.Heading>
      <p>Message emis avec succes.</p>
      <Row>
        <Col>
          <Button onClick={nouveauHandler}>Nouveau message</Button>
        </Col>
      </Row>
    </Alert>
  )
}

function formatterMessage(champ1) {
  const contenu = `
  <h2>Application Sample File Form</h2>
  <p>---</p>
  <p>Champ 1 : ${champ1}</p>
  <p>---</p>
  `

  return contenu
}

async function submitForm(urlConnexion, workers, contenu, token, certifcatsChiffragePem, opts) {
  opts = opts || {}
  const { application_id, fichiers } = opts

  const from = 'Landing page files'
  const subject = 'File Form ' + new Date().toLocaleString()
  const reponse = await submitHtmlForm(
    workers, application_id, contenu, token, certifcatsChiffragePem, {urlConnexion, from, subject, fichiers})

  console.debug("Reponse submit : ", reponse)

  return reponse
}

function ListeFichiers(props) {
  const { fichiers } = props

  const mapFichiers = useMemo(()=>{
    if(!fichiers) return ''
    return fichiers.map(item=>{
      try {
        const fuuid = item.transactionGrosfichiers.fuuid
        return (
          <Row key={fuuid}>
            <Col>{item.nom}</Col>
            <Col>{item.taille} bytes</Col>
            <Col>{item.transactionGrosfichiers.mimetype}</Col>
          </Row>
        )
      } catch(err) {
        console.warn("Erreur affichage transaction grosfichiers %O : %O", item, err)
      }
    })
  }, [fichiers])

  if(!fichiers || fichiers.length === 0) return ''

  return (
    <div>
      {mapFichiers}
    </div>
  )
}