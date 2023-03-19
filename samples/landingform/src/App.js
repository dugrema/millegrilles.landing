import { Suspense, useState, useCallback, useEffect } from 'react'

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

  const [token, setToken] = useState('')

  const resetTokenHandler = useCallback(()=>setToken(''), [setToken])

  useEffect(()=>{
    if(token || !config) return  // Rien a faire
    getToken(urlConnexion, config.application_id)
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
        urlConnexion = useUrlConnexion()

  const [champ1, setChamp1] = useState('')

  const champ1ChangeHandler = useCallback(e=>setChamp1(e.currentTarget.value), [setChamp1])

  const submitHandler = useCallback(()=>{
    const contenu = `
    <h2>Application Sample Form</h2>
    <p>---</p>
    <p>Champ 1 : ${champ1}</p>
    <p>---</p>
    `
    const certificats = workers.config.getClesChiffrage()
    console.debug("Submit %O, certificats %O", contenu, certificats)
    submitForm(urlConnexion, workers, contenu, token, certificats)
      .then(r=>{
        console.debug("Reponse submit ", r)
        resetToken()
      })
      .catch(err=>console.error("Erreur submit form ", err))
  }, [urlConnexion, workers, champ1, token, resetToken])

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

async function getToken(urlConnexion, application_id) {
    // Generer nouveau token
    const urlToken = new URL(urlConnexion)
    urlToken.pathname = urlToken.pathname + '/public/token'
    urlToken.searchParams.set('application_id', application_id)

    const axiosImport = await import('axios')
    const reponse = await axiosImport.default.get(urlToken.href)
    const data = reponse.data
    console.debug("Reponse token ", data)
    const token = data.token
    return token
}

async function submitForm(urlConnexion, workers, contenu, token, certifcatsChiffragePem) {

  const from = 'Landing - Sample Form'
  const opts = { /*to: ['Sample Form Handler']*/ }
  const messageChiffre = await chiffrerMessage(workers, certifcatsChiffragePem, from, contenu, opts)
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
