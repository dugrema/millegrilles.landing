import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { setupWorkers } from './workers/workerLoader'

const Context = createContext()

const { workers: _workers, ready } = setupWorkers()

// Hooks
function useWorkers() {
    // return useContext(Context).workers
    return _workers
}
export default useWorkers

export function useEtatPret() {
    return useContext(Context).etatPret
}

export function useUrlConnexion() {
    return useContext(Context).urlConnexion
}

export function useConfig() {
    return useContext(Context).config
}

// Provider
export function WorkerProvider(props) {

    // const [workers, setWorkers] = useState('')
    const [workersPrets, setWorkersPrets] = useState(false)
    const [urlConnexion, setUrlConnexion] = useState('')
    const [config, setConfig] = useState('')

    const etatPret = useMemo(()=>{
        return workersPrets
    }, [workersPrets])

    const value = useMemo(()=>{
        if(workersPrets) return { etatPret, urlConnexion, config }
    }, [workersPrets, etatPret])

    useEffect(()=>{
        // Initialiser workers et tables collections dans IDB
        Promise.all([ready])
            .then(()=>{
                console.info("Workers prets")
                setWorkersPrets(true)

                const urlApplication = _workers.config.getUrlsApplication().pop()
                console.info("URL application ", urlApplication.href)
                setUrlConnexion(urlApplication.href)
                const config = _workers.config.getConfig()
                setConfig(config)
            })
            .catch(err=>console.error("Erreur initialisation collections IDB / workers ", err))
    }, [setWorkersPrets])

    if(!workersPrets) return props.attente

    return <Context.Provider value={value}>{props.children}</Context.Provider>
}

export function WorkerContext(props) {
    return <Context.Consumer>{props.children}</Context.Consumer>
}
