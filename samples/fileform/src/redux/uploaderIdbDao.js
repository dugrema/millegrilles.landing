import { openDB } from 'idb'

const DB_NAME = 'landing',
      DB_VERSION = 2,
      STORE_UPLOADS = 'uploads',
      STORE_UPLOADS_FICHIERS = 'uploadsFichiers'
      

export function ouvrirDB(opts) {
    opts = opts || {}

    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            createObjectStores(db, oldVersion)
        },
        blocked() {
            console.error("OpenDB %s blocked", DB_NAME)
        },
        blocking() {
            console.warn("OpenDB, blocking")
        }
    })

}

function createObjectStores(db, oldVersion) {
    // console.debug("dbUsagers upgrade, DB object (version %s): %O", oldVersion, db)
    /*eslint no-fallthrough: "off"*/
    let fichierStore = null
    try {
        switch(oldVersion) {
            case 0:
            case 1: 
                db.createObjectStore(STORE_UPLOADS, {keyPath: ['correlationSubmitId', 'correlation']})
                db.createObjectStore(STORE_UPLOADS_FICHIERS, {keyPath: ['correlationSubmitId', 'correlation', 'position']})
            case 2: // Plus recent, rien a faire
                break
            default:
            console.warn("createObjectStores Default..., version %O", oldVersion)
        }
    } catch(err) {
        console.error("Erreur preparation IDB : ", err)
        throw err
    }
}

export function init() {
    return ouvrirDB()
}

export async function entretien() {
    const db = await ouvrirDB()

    // Retirer les valeurs expirees
    await retirerUploadsExpires(db)
}

export async function chargerUploads(correlationSubmidId) {
    if(!correlationSubmidId) throw new Error("Il faut fournir le userId")
    const db = await ouvrirDB()
    const store = db.transaction(STORE_UPLOADS, 'readonly').store
    let curseur = await store.openCursor()
    const uploads = []
    while(curseur) {
        const correlationSubmidIdCurseur = curseur.value.correlationSubmidId
        if(correlationSubmidIdCurseur === correlationSubmidId) uploads.push(curseur.value)
        curseur = await curseur.continue()
    }
    return uploads
}

// doc { correlation, dateCreation, retryCount, transactionGrosfichiers, transactionMaitredescles }
export async function updateFichierUpload(doc) {
    const { correlationSubmitId, correlation } = doc
    if(!correlationSubmitId) throw new Error('updateFichierUpload Le document doit avoir un champ correlationSubmitId')
    if(!correlation) throw new Error('updateFichierUpload Le document doit avoir un champ correlation')

    const db = await ouvrirDB()
    const store = db.transaction(STORE_UPLOADS, 'readwrite').store
    let docExistant = await store.get(correlation)
    if(!docExistant) {
        if(!correlationSubmitId) throw new Error('updateFichierUpload Le document doit avoir un champ correlationSubmitId')
        docExistant = {...doc}
    } else {
        Object.assign(docExistant, doc)
    }

    docExistant.derniereModification = new Date().getTime()

    await store.put(docExistant)
}

export async function ajouterFichierUploadFile(correlationSubmitId, correlation, position, data) {
    if(!correlationSubmitId) throw new Error('ajouterFichierUpload Le document doit avoir un champ correlationSubmitId')
    if(!correlation) throw new Error('ajouterFichierUpload Le document doit avoir un champ correlation')
    if(typeof(position) !== 'number') throw new Error('ajouterFichierUpload Il faut fournir une position')
    if(data.length === 0) return   // Rien a faire

    // console.debug("ajouterFichierUploadFile %s position %d len %d", correlation, position, data.length)

    const db = await ouvrirDB()
    const store = db.transaction(STORE_UPLOADS_FICHIERS, 'readwrite').store
    const blob = new Blob([data])
    const taille = data.length
    await store.put({correlationSubmitId, correlation, position, taille, data: blob})
}

export async function supprimerFichier(correlationSubmitId, correlation) {
    const db = await ouvrirDB()
    const storeFichiers = db.transaction(STORE_UPLOADS_FICHIERS, 'readwrite').store
    
    // Supprimer fichiers (blobs)
    let cursorFichiers = await storeFichiers.openCursor()
    while(cursorFichiers) {
        const correlationSubmitIdCursor = cursorFichiers.value.correlationSubmitId
        const correlationCursor = cursorFichiers.value.correlation
        if(correlationSubmitIdCursor === correlationSubmitId && correlationCursor === correlation) {
            // console.debug("Delete cursorFichiers : ", cursorFichiers.value)
            await cursorFichiers.delete()
        }
        cursorFichiers = await cursorFichiers.continue()
    }

    // Supprimer entree upload
    const storeUploads = db.transaction(STORE_UPLOADS, 'readwrite').store
    await storeUploads.delete([correlationSubmitId, correlation])
}

// Supprime le contenu de idb
export async function clear() {
    const db = await ouvrirDB()
    const storeUploadsFichiers = db.transaction(STORE_UPLOADS_FICHIERS, 'readwrite').store
    await storeUploadsFichiers.clear()
    const storeUploads = db.transaction(STORE_UPLOADS, 'readwrite').store
    await storeUploads.clear()
}

export async function supprimerParEtat(userId, etat) {
    throw new Error('supprimerParEtat - fix me')
    // console.debug("supprimerParEtat userId %s etat %s ", userId, etat)
    if(!userId) throw new Error("userId est requis pour supprimerParEtat")
    if(etat === undefined) throw new Error("etat est requis pour supprimerParEtat")

    const db = await ouvrirDB()
    let storeUploads = db.transaction(STORE_UPLOADS, 'readonly').store

    // Trouvers correlations a supprimer
    const correlationsSupprimer = []

    let curseurUpload = await storeUploads.openCursor()
    while(curseurUpload) {
        const { correlation, userId: userIdCurseur, etat: etatCurseur } = curseurUpload.value
        if(userIdCurseur === userId && etatCurseur === etat) {
            // console.debug("Supprimer ", curseurUpload.value)
            correlationsSupprimer.push(correlation)
        }
        curseurUpload = await curseurUpload.continue()
    }

    // console.debug("Surppimer etat %d, correlations %O", etat, correlationsSupprimer)

    // Supprimer fichiers
    const storeUploadsFichiers = db.transaction(STORE_UPLOADS_FICHIERS, 'readwrite').store
    let curseurFichiers = await storeUploadsFichiers.openCursor()
    while(curseurFichiers) {
        const { correlation: correlationFichier } = curseurFichiers.value
        if(correlationsSupprimer.includes(correlationFichier)) await curseurFichiers.delete()
        curseurFichiers = await curseurFichiers.continue()
    }

    // Supprimer uploads
    storeUploads = db.transaction(STORE_UPLOADS, 'readwrite').store
    for await (const correlation of correlationsSupprimer) {
        await storeUploads.delete(correlation)
    }
}

export async function getPartsFichier(correlationSubmitId, correlation) {
    if(correlationSubmitId === undefined || correlation === undefined) return
    const db = await ouvrirDB()
    const storeUploadsFichiers = db.transaction(STORE_UPLOADS_FICHIERS, 'readonly').store
    const parts = []
    let curseur = await storeUploadsFichiers.openCursor()
    while(curseur) {
        const {key, value} = curseur
        const [correlationSubmitIdCurseur, correlationCurseur] = key
        if(correlationCurseur === correlation && correlationSubmitIdCurseur === correlationSubmitId) parts.push(value)
        curseur = await curseur.continue()
    }
    return parts
}

async function retirerUploadsExpires(db) {
    const now = new Date().getTime()
    // console.debug("Expirer documents avant ", new Date(now))
    const store = db.transaction(STORE_UPLOADS, 'readwrite').store
    let curseur = await store.openCursor()
    while(curseur) {
        const { expiration } = curseur.value
        if(expiration < now) {
            curseur.delete()
        }
        curseur = await curseur.continue()
    }
}

export async function supprimerPartsFichier(correlationSubmitId, correlation) {
    if(correlationSubmitId === undefined || correlation === undefined) return

    const db = await ouvrirDB()
    const storeUploadsFichiers = db.transaction(STORE_UPLOADS_FICHIERS, 'readwrite').store
    let curseur = await storeUploadsFichiers.openCursor()
    while(curseur) {
        const {key} = curseur
        const [correlationSubmitIdCurseur, correlationCurseur] = key
        if(correlationSubmitIdCurseur === correlationSubmitId && correlationCurseur === correlation) await curseur.delete()
        curseur = await curseur.continue()
    }
}
