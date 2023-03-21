import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { proxy as comlinkProxy } from 'comlink'
import { useSelector, useDispatch } from 'react-redux'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, { WorkerProvider, useEtatPret, useUrlConnexion, useConfig } from './WorkerContext'
import { chiffrerMessage } from './messageUtils'

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

  const [token, setToken] = useState('')
  const [correlationSubmitId, setCorrelationSubmitId] = useState('')
  const resetTokenHandler = useCallback(()=>setToken(''), [setToken])

  useEffect(()=>{
    if(token || !config) return  // Rien a faire
    getToken(urlConnexion, config.application_id)
      .then(data=>{
        setToken(data.token)
        setCorrelationSubmitId(data.uuid_transaction)
        // dispatch() // TODO Set correlation Id
      })
      .catch(err=>console.error("Erreur chargement token ", err))
  }, [dispatch, config, urlConnexion, token, setToken, setCorrelationSubmitId])

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
        <p>Correlation Submit Id : {correlationSubmitId}</p>
        <div>
          <div>Token session</div>
          <div style={{'fontSize': 'x-small'}}>{token.replaceAll('\.', '\. ')}</div>
        </div>
      </Alert>

      <FormApplication 
        token={token}
        correlationSubmitId={correlationSubmitId}
        resetToken={resetTokenHandler} />

    </Container>
  )
}

function Attente(props) {
  return <p>Chargement en cours</p>
}

function FormApplication(props) {

  const { token, resetToken, correlationSubmitId } = props

  const workers = useWorkers(),
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

  const champ1ChangeHandler = useCallback(e=>setChamp1(e.currentTarget.value), [setChamp1])

  const submitHandler = useCallback( e => {
    e.preventDefault()
    e.stopPropagation()

    const contenu = `
    <h2>Application Sample Form</h2>
    <p>---</p>
    <p>Champ 1 : ${champ1}</p>
    <p>---</p>
    `
    const certificats = workers.config.getClesChiffrage()
    console.debug("Submit %O, certificats %O", contenu, certificats)
    submitForm(urlConnexion, workers, contenu, token, certificats, {application_id: config.application_id})
      .then(r=>{
        console.debug("Reponse submit ", r)
        resetToken()
      })
      .catch(err=>console.error("Erreur submit form ", err))
  }, [urlConnexion, workers, config, champ1, token, resetToken])

  return (
    <div>
      <h2>Form</h2>

      <Form.Group as={Row} controlId="champ1">
        <Form.Label column sm={4} md={2}>Champ 1</Form.Label>
        <Col>
            <Form.Control value={champ1} onChange={champ1ChangeHandler} />
        </Col>
      </Form.Group>

      <Row>
        <Col>
          <BoutonUpload 
            setPreparationUploadEnCours={setPreparationUploadEnCours} 
            signalAnnuler={signalAnnuler.signal}
            correlationSubmitId={correlationSubmitId}>
            <i className="fa fa-plus"/> Fichier
          </BoutonUpload>
        </Col>
      </Row>

      <br/>

      <Row>
        <Col>
          <Button onClick={submitHandler}>Submit</Button>
        </Col>
      </Row>

    </div>
  )
}

async function getToken(urlConnexion, application_id) {
    // Generer nouveau token
    const urlToken = new URL(urlConnexion)
    urlToken.pathname = urlToken.pathname + '/public/token'
    urlToken.searchParams.set('application_id', application_id)

    const axiosImport = await import('axios')
    const reponse = await axiosImport.default.get(urlToken.href)
    const data = reponse.data
    console.debug("Reponse token ", data)
    return data
    //const token = data.token
    //return token
}

async function submitForm(urlConnexion, workers, contenu, token, certifcatsChiffragePem, opts) {
  opts = opts || {}
  const application_id = opts.application_id

  const from = 'Landing page'
  const subject = 'Sample Form ' + new Date()
  const optionsMessage = { subject, /*to: ['Sample Form Handler']*/ }

  const headerContenu = `
  <p>--- HEADER ---</p>
  <div class='header'>
    <p>Application Id : ${application_id}</p>
    <p>Date client : ${''+new Date()}</p>
  </div>
  <p>--- FIN HEADER ---</p>
  <p> </p>
  `
  const contenuAvecHeader = headerContenu + contenu

  const messageChiffre = await chiffrerMessage(workers, certifcatsChiffragePem, from, contenuAvecHeader, optionsMessage)
  console.debug("Message chiffre : ", messageChiffre)

  const axiosImport = await import('axios')

  const url = new URL(urlConnexion)
  url.pathname = url.pathname + '/public/submit'

  const reponse = await axiosImport.default({
    method: 'POST',
    url: url.href,
    data: {message: messageChiffre, token},
  })

  return reponse.data
}

function BoutonUpload(props) {

  const { setPreparationUploadEnCours, signalAnnuler, resetAnnuler, correlationSubmitId } = props

  const refUpload = useRef()
  const workers = useWorkers()
  // const usager = useUsager()
  const dispatch = useDispatch()
  // const cuuid = useSelector(state=>state.fichiers.cuuid)

  const [className, setClassName] = useState('')

  const { traitementFichiers } = workers

  const handlerPreparationUploadEnCours = useCallback(event=>{
      // console.debug('handlerPreparationUploadEnCours ', event)
      setPreparationUploadEnCours(event)
  }, [setPreparationUploadEnCours])

  const upload = useCallback( acceptedFiles => {
      console.debug("Files : %O pour correlationSubmitId: %s, signalAnnuler: %O", acceptedFiles, correlationSubmitId, signalAnnuler)
      
      handlerPreparationUploadEnCours(0)  // Debut preparation

      traitementFichiers.traiterAcceptedFiles(dispatch, correlationSubmitId, null, acceptedFiles, {signalAnnuler, setProgres: handlerPreparationUploadEnCours})
          .then(uploads=>{
              console.debug("Uploads ", uploads)
              // const correlationIds = uploads.map(item=>item.correlation)
              // return dispatch(demarrerUploads(workers, correlationIds))
          })
          .catch(err=>console.error("Erreur fichiers : %O", err))
          .finally( () => handlerPreparationUploadEnCours(false) )

  }, [handlerPreparationUploadEnCours, traitementFichiers, dispatch, correlationSubmitId])

  const fileChange = event => {
      event.preventDefault()
      setClassName('')

      const acceptedFiles = event.currentTarget.files
      upload(acceptedFiles)
  }

  const onButtonDrop = event => {
      event.preventDefault()
      setClassName('')

      const acceptedFiles = event.dataTransfer.files
      upload(acceptedFiles)
  }

  const handlerOnDragover = event => {
      event.preventDefault()
      setClassName('dropping')
      event.dataTransfer.dropEffect = "move"
  }

  const handlerOnDragLeave = event => { event.preventDefault(); setClassName(''); }

  const handlerOnClick = event => {
      refUpload.current.click()
  }

  return (
      <div 
          className={'upload ' + className}
          onDrop={onButtonDrop}
          onDragOver={handlerOnDragover} 
          onDragLeave={handlerOnDragLeave}
        >
          <Button 
              variant="secondary" 
              className="individuel"
              onClick={handlerOnClick}
              disabled={!correlationSubmitId}
            >
              {props.children}
          </Button>
          <input
              id='file_upload'
              type='file' 
              ref={refUpload}
              multiple
              onChange={fileChange}
            />
      </div>
  )
}
