import { useState, useEffect, useCallback } from 'react'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import useWorkers, { useEtatPret } from './WorkerContext'

function ListeApplications(props) {

    const [liste, setListe] = useState('')

    const workers = useWorkers(),
          etatPret = useEtatPret()

    const nouvelleHandler = useCallback(e=>{
        workers.connexion.creerNouvelleApplication()
            .then(r=>{
                console.debug("Reponse nouvelle application ", r)
            })
            .catch(err=>console.error("Erreur nouvelle application ", err))
    }, [workers])

    useEffect(()=>{
        workers.connexion.getListeApplications()
            .then(l=>{
                console.debug("Liste applications ", l)
                setListe(l.applications)
            })
            .catch(err=>{
                console.debug("Erreur chargement liste ", err)
                setListe([])
            })
    }, [workers, setListe])

    return (
        <div>
            <Row>
                <Col>
                    <Button onClick={nouvelleHandler} disabled={!etatPret}>Nouvelle</Button>
                </Col>
            </Row>

            <p></p>

            <AfficherListe liste={liste} />

        </div>
    )
}

export default ListeApplications

function AfficherListe(props) {
    const liste = props.liste

    if(!liste) {
        return <p>Chargement en cours</p>
    } else if(liste.length === 0) {
        return <p>Aucunes applications</p>
    }

    return (
        <div>
            <Row>
                <Col xs={12} md={5} lg={6}>Nom</Col>
                <Col xs={8} md={6} lg={5}>Application ID</Col>
                <Col xs={4} md={1} lg={1}>Etat</Col>
            </Row>
            {liste.map(item=>(<RowApplication key={item.application_id} value={item}/>))}
        </div>
    )
}

function RowApplication(props) {
    const value = props.value

    return (
        <Row>
            <Col xs={12} md={5} lg={6}>{value.nom || value.application_id}</Col>
            <Col xs={8} md={6} lg={5}>{value.application_id}</Col>
            <Col xs={4} md={1} lg={1}>{value.etat}</Col>
        </Row>
    )
}