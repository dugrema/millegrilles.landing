import debugLib from 'debug'
const debug = debugLib('mqdao')

const L2Prive = '2.prive'

const DOMAINE_LANDING = 'Landing'

export function challenge(socket, params) {
    // Repondre avec un message signe
    const reponse = {
        reponse: params.challenge,
        message: 'Trust no one',
        nomUsager: socket.nomUsager,
        userId: socket.userId,
    }
    return socket.amqpdao.pki.formatterMessage(reponse, 'challenge', {ajouterCertificat: true})
}

// export function getCategoriesUsager(socket, params) {
//     return transmettreRequete(socket, params, 'getCategoriesUsager')
// }

// export function sauvegarderCategorieUsager(socket, params) {
//     return transmettreCommande(socket, params, 'sauvegarderCategorieUsager')
// }

async function transmettreRequete(socket, params, action, opts) {
    opts = opts || {}
    const entete = params['en-tete'] || {}
    const domaine = opts.domaine || entete.domaine || DOMAINE_LANDING
    const partition = opts.partition || entete.partition
    const exchange = opts.exchange || L2Prive
    try {
        verifierMessage(params, domaine, action)
        return await socket.amqpdao.transmettreRequete(
            domaine, 
            params, 
            {action, partition, exchange, noformat: true, decoder: true}
        )
    } catch(err) {
        console.error("mqdao.transmettreRequete ERROR : %O", err)
        return {ok: false, err: ''+err}
    }
}

async function transmettreCommande(socket, params, action, opts) {
    opts = opts || {}
    const entete = params['en-tete'] || {}
    const domaine = opts.domaine || entete.domaine || DOMAINE_LANDING
    const partition = opts.partition || entete.partition
    const exchange = opts.exchange || L2Prive
    const nowait = opts.nowait
    try {
        verifierMessage(params, domaine, action)
        return await socket.amqpdao.transmettreCommande(
            domaine, 
            params, 
            {action, partition, exchange, noformat: true, decoder: true, nowait}
        )
    } catch(err) {
        console.error("mqdao.transmettreCommande ERROR : %O", err)
        return {ok: false, err: ''+err}
    }
}

/* Fonction de verification pour eviter abus de l'API */
function verifierMessage(message, domaine, action) {
    console.debug("Verifier domaine %s action %s pour %O", domaine, action, message)
    const entete = message['en-tete'] || {},
          domaineRecu = entete.domaine,
          actionRecue = entete.action
    if(domaineRecu !== domaine) throw new Error(`Mismatch domaine (${domaineRecu} !== ${domaine})"`)
    if(actionRecue !== action) throw new Error(`Mismatch action (${actionRecue} !== ${action})"`)
}

// export async function ecouterEvenementsCategoriesUsager(socket, cb) {
//     const routingKeys = [
//         `evenement.Documents.${socket.userId}.sauvegarderCategorieUsager`,
//     ]
//     socket.subscribe({routingKeys, exchanges: [L2Prive]}, cb)
// }

// export async function retirerEvenementsCategoriesUsager(socket, cb) {
//     const routingKeys = [
//         `evenement.Documents.${socket.userId}.sauvegarderCategorieUsager`,
//     ]
//     socket.unsubscribe({routingKeys, exchanges: [L2Prive]})
//     if(cb) cb(true)
// }
