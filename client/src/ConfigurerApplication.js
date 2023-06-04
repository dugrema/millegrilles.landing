import { useState, useCallback, useEffect, useMemo } from 'react'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import useWorkers, { useEtatPret, useInfoConnexion } from './WorkerContext'

function ConfigurerApplication(props) {
    const { applicationId, setApplicationId } = props

    const workers = useWorkers(),
          etatPret = useEtatPret(),
          infoConnexion = useInfoConnexion()

    const [application, setApplication] = useState('')

    const nom = useMemo(()=>application.nom || '', [application])
    const actif = useMemo(()=>application.actif || '', [application])

    const configFichier = useMemo(()=>{
        const urlFiche = new URL(window.location.href)
        urlFiche.pathname = '/fiche.json'
        const config = {
            application_id: application.application_id,
            fiche_url: urlFiche.href,
            idmg: infoConnexion.idmg,
        }
        return JSON.stringify(config, null, 2)
    }, [application])

    const fermerHandler = useCallback(()=>setApplicationId(''), [setApplicationId])
    const nomChangeHandler = useCallback(e=>{
        const nom = e.currentTarget.value
        const update = {...application, nom}
        setApplication(update)
    }, [application, setApplication])
    const actifChangeHandler = useCallback(e=>{
        const actif = e.currentTarget.checked
        console.debug("Changer actif pour %s", actif)
        const update = {...application, actif}
        setApplication(update)
    }, [application, setApplication])

    const sauvegaderHandler = useCallback(()=>{
        console.debug("Sauvegarder application ", application)
        workers.connexion.sauvegarderApplication(application)
            .then(r=>{
                console.debug("Reponse maj application ", r)
                fermerHandler()
            })
            .catch(err=>console.error("Erreur sauvegarde application ", err))
    }, [workers, application, fermerHandler])

    useEffect(()=>{
        console.debug("Charger application ", applicationId)
        workers.connexion.getApplication(applicationId)
            .then(app=>{
                console.debug("Application recue ", app)
                if(app.ok === false) return console.error("Erreur chargement application : ", app.err)
                // Filtrer champs recus
                const appRecue = {}
                const champs = ['application_id', 'nom', 'actif']
                Object.keys(app).forEach(item=>{
                    if(champs.includes(item)) appRecue[item] = app[item]
                })
                setApplication(appRecue)
            })
            .catch(err=>console.error("Erreur chargement application : ", err))
    }, [workers, setApplication])

    if(!application) return 'Chargement en cours'

    return (
        <div>
            <Row>
                <Col>
                    <h3>Configurer l'application</h3>
                </Col>
                <Col xs={2} md={1}>
                    <Button variant="secondary" onClick={fermerHandler}>X</Button>
                </Col>
            </Row>

            <Row>
                <Col>Application ID</Col>
                <Col>{application.application_id}</Col>
            </Row>

            <Form.Group as={Row} controlId="nomApplication">
                <Form.Label column sm={4} md={2}>Nom</Form.Label>
                <Col>
                    <Form.Control value={nom} onChange={nomChangeHandler} />
                </Col>
            </Form.Group>

            <Form.Group as={Row} controlId="etatActif">
                <Form.Label column sm={4} md={2}>Actif</Form.Label>
                <Col>
                    <Form.Check type="switch" checked={actif} onChange={actifChangeHandler} />
                </Col>
            </Form.Group>

            <p></p>

            <Row>
                <Col>
                    <Button onClick={sauvegaderHandler} disabled={!etatPret}>Sauvegarder</Button>
                    {' '}
                    <Button variant="secondary" onClick={fermerHandler}>Annuler</Button>
                </Col>
            </Row>

            <p></p>

            <h3>Configuration</h3>

            <p>Fichier config.json : copier ce fichier dans le repertoire /public de l'application deployee.</p>

            <pre>{configFichier}</pre>

        </div>
    )
}

export default ConfigurerApplication

{/* <Form.Group as={Row} controlId="groupeId">
<Form.Label column sm={4} md={2}>Groupe</Form.Label>
<Col>
    <Form.Select value={value} onChange={onChange} disabled={!!docId}>
        <SelectionGroupeOptions groupes={groupes} />
    </Form.Select>        
</Col>
</Form.Group> */}
