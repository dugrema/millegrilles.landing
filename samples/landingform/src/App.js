import { Suspense, useState, useCallback, useEffect } from 'react'

import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'

import { getToken, submitHtmlForm } from '@dugrema/millegrilles.reactjs/src/landing.js'

import ErrorBoundary from './ErrorBoundary'
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

  const etatPret = useEtatPret()
  const urlConnexion = useUrlConnexion()
  const config = useConfig()

  const [token, setToken] = useState('')

  const resetTokenHandler = useCallback(()=>setToken(''), [setToken])

  useEffect(()=>{
    if(token || !config) return  // Rien a faire
    console.debug("url connexion : ", urlConnexion)
    getToken(config, {urlConnexion})
      .then(setToken)
      .catch(err=>console.error("Erreur chargement token ", err))
  }, [config, urlConnexion, token, setToken])

  return (
    <Container>
      <h1>Sample form</h1>
      <Alert variant='info'>
        <Alert.Heading>Information backend</Alert.Heading>
        <p>Application Id : {config.application_id}</p>
        <p>URL connexion : {urlConnexion}</p>
        <p>Etat pret : {etatPret?'Oui':'Non'}</p>
        <div>
          <div>Token session</div>
          <div style={{'fontSize': 'x-small'}}>{token.replaceAll('\.', '\. ')}</div>
        </div>
      </Alert>

      <FormApplication 
        token={token}
        resetToken={resetTokenHandler} />

    </Container>
  )
}

function Attente(props) {
  return <p>Chargement en cours</p>
}

function FormApplication(props) {

  const { token, resetToken } = props

  const workers = useWorkers(),
        urlConnexion = useUrlConnexion(),
        config = useConfig()

  const [champ1, setChamp1] = useState('')

  const champ1ChangeHandler = useCallback(e=>setChamp1(e.currentTarget.value), [setChamp1])

  const submitHandler = useCallback( e => {
    e.preventDefault()
    e.stopPropagation()

    const contenuHtml = formatterMessage(champ1)
    const certificats = workers.config.getClesChiffrage()
    console.debug("Submit %O, certificats %O", contenuHtml, certificats)
    submitForm(urlConnexion, workers, contenuHtml, token, certificats, {application_id: config.application_id})
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

      <br/>

      <Row>
        <Col>
          <Button onClick={submitHandler}>Submit</Button>
        </Col>
      </Row>
    </div>
  )
}

function formatterMessage(champ1) {
  const contenu = `
  <h2>Application Sample Form</h2>
  <p>---</p>
  <p>Champ 1 : ${champ1}</p>
  <p>---</p>
  `

  return contenu
}

async function submitForm(urlConnexion, workers, contenu, token, certifcatsChiffragePem, opts) {
  opts = opts || {}
  const application_id = opts.application_id

  const from = 'Landing page'
  const subject = 'Sample Form ' + new Date().toLocaleString()
  const reponse = await submitHtmlForm(
    workers, application_id, contenu, token, certifcatsChiffragePem, {urlConnexion, from, subject})

  console.debug("Reponse submit : ", reponse)

  return reponse
}
