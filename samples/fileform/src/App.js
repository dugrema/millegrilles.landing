import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { proxy as comlinkProxy } from 'comlink'
import { useSelector, useDispatch } from 'react-redux'

// Imports landing
import { ErrorBoundary, landingReact } from '@dugrema/millegrilles.reactjs'
import { getToken, submitHtmlForm, preparerFichiersBatch } from '@dugrema/millegrilles.reactjs/src/landing/landing.js'
import { setToken, clearToken } from '@dugrema/millegrilles.reactjs/src/landing/uploaderSlice'
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

  const tokenFormatte = useMemo(()=>{
    if(!token) return ''
    return token.replaceAll('\.', '\. ')
  }, [token])

  useEffect(()=>{
    if(token || !config) return  // Rien a faire
    getToken(config, {urlConnexion})
      .then(data=>{
        console.debug("Token data ", data)
        dispatch(setToken({token: data.token, batchId: data.uuid_transaction}))
      })
      .catch(err=>console.error("Erreur chargement token ", err))
  }, [dispatch, config, urlConnexion, token])

  useEffect(()=>{
    const urlUpload = urlConnexion + '/public/fichiers'
    console.debug("!Update path serveur pour upload fichiers : %s ", urlUpload)
    workers.transfertFichiers.up_setPathServeur(urlUpload)
      .catch(err=>console.error("Erreur changement URL connexion pour upload", err))
  }, [workers, urlConnexion])

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

      <FormApplication />

    </Container>
  )
}

function Attente(props) {
  return <p>Chargement en cours</p>
}

function FormApplication(props) {

  const token = useSelector(state=>state.uploader.token)
  const batchId = useSelector(state=>state.uploader.batchId)
  const progres = useSelector(state=>state.uploader.progres)
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
    if(progres || preparationUploadEnCours) return true
    return false
  }, [progres, preparationUploadEnCours])

  const champ1ChangeHandler = useCallback(e=>setChamp1(e.currentTarget.value), [setChamp1])

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
        dispatch(clearToken())
      })
      .catch(err=>console.error("Erreur submit form ", err))
  }, [dispatch, batchId, urlConnexion, workers, config, champ1, token])

  useEffect(()=>{
    console.debug('Liste fichiers upload : ', liste)
  }, [liste])

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

      <landingReact.ProgresUpload dispatch={dispatch} progres={progres} preparation={preparationUploadEnCours} />

      <br/>

      <ListeFichiers fichiers={liste} />

      <Row>
        <Col>
          <Button onClick={submitHandler} disabled={transfertEnCours}>Submit</Button>
        </Col>
      </Row>

    </div>
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
      return (
        <Row>
          <Col>{item.nom}</Col>
          <Col>{item.taille} bytes</Col>
          <Col>{item.transactionGrosfichiers.mimetype}</Col>
        </Row>
      )
    })
  }, [fichiers])

  if(!fichiers || fichiers.length === 0) return ''

  return (
    <div>
      {mapFichiers}
    </div>
  )
}