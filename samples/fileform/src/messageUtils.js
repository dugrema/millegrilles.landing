import pako from 'pako'

export async function chiffrerMessage(workers, certifcatsChiffragePem, from, content, opts) {
    opts = opts || {}

    // const {connexion, chiffrage} = workers
    const { chiffrage } = workers
    const champsOptionnels = ['subject', 'to']

    const message = { from, content }
    champsOptionnels.forEach(nomChamp=>{
        if(opts[nomChamp]) message[nomChamp] = opts[nomChamp]
    })

    let fuuids = null
    if(opts.files) {
        const files = opts.files
        message.files = files
        fuuids = files.map(item=>item.fuuid)
    }

    console.debug("Compresser/chiffrer ", message)

    // Compresser le message en gzip
    let messageBytes = JSON.stringify(message)
    // console.debug("Message signe taille %d\n%s", messageBytes.length, messageBytes)
    messageBytes = pako.deflate(new TextEncoder().encode(messageBytes))
    // console.debug("Message signe gzippe : %O", messageBytes)

    // Chiffrer le message 
    const messageChiffre = await chiffrage.chiffrerDocument(
        messageBytes, 'Messagerie', certifcatsChiffragePem, 
        {DEBUG: true, identificateurs_document: {'landing': 'true'}, nojson: true, type: 'binary'}
    )
    console.debug("Message chiffre : %O", messageChiffre)

    const commandeMaitrecles = messageChiffre.commandeMaitrecles
    commandeMaitrecles.partition = commandeMaitrecles['_partition']
    delete commandeMaitrecles['_partition']

    // Preparer l'enveloppe du message
    const enveloppeMessage = {
        message_chiffre: messageChiffre.doc.data_chiffre,
        hachage_bytes: commandeMaitrecles['hachage_bytes'],
    }

    const resultat = { enveloppeMessage, commandeMaitrecles }
    if(fuuids) resultat.fuuids = fuuids

    return resultat
}
