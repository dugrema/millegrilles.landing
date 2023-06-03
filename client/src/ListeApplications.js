import { useState, useEffect, useCallback } from 'react'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import useWorkers, { useEtatPret } from './WorkerContext'

function ListeApplications(props) {

    const { setApplicationId } = props

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

    const applicationSelectHandler = useCallback(e=>{
        const applicationId = e.currentTarget.value
        setApplicationId(applicationId)
      }, [setApplicationId])
    
    useEffect(()=>{
        workers.connexion.getListeApplications()
            .then(l=>{
                console.debug("Liste applications ", l)
                const applications = l.applications
                if(applications) applications.sort(sortApplications)
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

            <AfficherListe 
                liste={liste} 
                applicationSelect={applicationSelectHandler} />

        </div>
    )
}

export default ListeApplications

function AfficherListe(props) {
    const { applicationSelect } = props
    const liste = props.liste

    if(!liste) {
        return <p>Chargement en cours</p>
    } else if(liste.length === 0) {
        return <p>Aucunes applications</p>
    }

    return (
        <div>
            <Row>
                <Col xs={2} md={1}>Actif</Col>
                <Col xs={10} md={11}>Nom</Col>
            </Row>
            {liste.map(item=>(<RowApplication key={item.application_id} value={item} applicationSelect={applicationSelect} />))}
        </div>
    )
}

function RowApplication(props) {
    const { value, applicationSelect } = props

    return (
        <Row>
            <Col xs={2} md={1}>{value.actif?<i className='fa fa-check'/>:''}</Col>
            <Col xs={10} md={11}>
                <Button variant='link' onClick={applicationSelect} value={value.application_id}>
                    {value.nom || value.application_id}
                </Button>
            </Col>
        </Row>
    )
}

function sortApplications(a, b) {
    const nomA = a.nom, nomB = b.nom,
          idA = a.application_id, idB = b.application_id

    if(nomA === nomB) {
        // Pass
    } else {
        if(!nomA) return 1
        return nomA.localeCompare(nomB)
    }

    if(idA === idB) return 0
    if(!idA) return 1
    return idA.localeCompare(idB)
}