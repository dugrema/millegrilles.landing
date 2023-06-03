import pako from 'pako'

export async function chiffrerMessage(workers, certifcatsChiffragePem, from, content, opts) {
    opts = opts || {}

    const { chiffrage } = workers
    const champsOptionnels = ['subject', 'to']
    const message = { from, content }
    champsOptionnels.forEach(nomChamp=>{
        if(opts[nomChamp]) message[nomChamp] = opts[nomChamp]
    })

    // let fuuidsCles = fuuids,
    //     fuuidAttachmentsTransfert = null
    // if(attachments) {
    //     console.debug("signerMessage Message attachments : %O", attachments)
    //     // Preparer l'information de dechiffrage (cle) pour tous les attachements
    //     // if(fuuidsCleSeulement) {
    //     //     fuuidsCles = [...fuuidsCles, ...fuuidsCleSeulement]
    //     // }

    //     // Faire une liste des fuuids d'attachments a transferer (pour l'enveloppe postmaster)
    //     fuuidAttachmentsTransfert = attachments.reduce((acc, attachment) =>{
    //         const hachage_bytes = attachment.fuuid
    //         acc.push(hachage_bytes)
    //         const images = attachment.images || {},
    //               videos = attachment.video || {}
    //         Object.values(images).filter(item=>!item.data).forEach(image=>{
    //             acc.push(image.hachage)
    //         })
    //         Object.values(videos).forEach(video=>acc.push(video.fuuid_video))
    //         return acc
    //     }, [])

    //     // Retirer cles deja connues
    //     const fuuidsClesInconnues = fuuidsCles.filter(item=>!attachmentsCles[item])
    //     let clesAttachmentsPrets = {...attachmentsCles}
    //     if(fuuidsClesInconnues.length > 0) {
    //         console.warn("signerMessage : il manque des cles (%O), charger maintenant", fuuidsClesInconnues)
    //         const cles = await getClesFormattees(workers, fuuidsClesInconnues)
    //         clesAttachmentsPrets = {...clesAttachmentsPrets, ...cles}
    //     }

    //     // console.debug("Cles attachments : ", clesAttachmentsPrets)

    //     // Dechiffrer metadata du fichier (remplacer data_chiffre par data)
    //     for await (const attachment of attachments) {
    //         const hachage_bytes = attachment.fuuid
    //         const metadata = {...attachment.metadata}
    //         attachment.metadata = metadata

    //         // console.debug("Dechiffrer metadata %s : %O", hachage_bytes, metadata)
    //         const cleDechiffrage = clesAttachmentsPrets[hachage_bytes]
    //         if(cleDechiffrage && metadata.data_chiffre) {
    //             const data_dechiffre = await chiffrage.chiffrage.dechiffrerChampsChiffres(metadata, cleDechiffrage)
    //             // console.debug("Metadata dechiffre %s : %O", hachage_bytes, data_dechiffre)
    //             delete metadata.data_chiffre
    //             metadata.data = data_dechiffre
    //         } else {
    //             console.warn("Erreur dechiffrage fuuid %s, cle absente", hachage_bytes)
    //         }
    //     }

    //     message.attachments = {
    //         cles: clesAttachmentsPrets,
    //         fichiers: attachments
    //     }
    // }

    // Compresser le message en gzip
    let messageBytes = JSON.stringify(message)
    // console.debug("Message signe taille %d\n%s", messageBytes.length, messageBytes)
    messageBytes = pako.deflate(new TextEncoder().encode(messageBytes))
    // console.debug("Message signe gzippe : %O", messageBytes)

    // Chiffrer le message 
    const messageChiffre = await chiffrage.chiffrerDocument(
        messageBytes, 'Landing', certifcatsChiffragePem, 
        {DEBUG: true, identificateurs_document: {}, nojson: true, type: 'binary'}
    )
    // console.debug("Message chiffre : %O", messageChiffre)

    const commandeMaitrecles = messageChiffre.commandeMaitrecles
    commandeMaitrecles.partition = commandeMaitrecles['_partition']
    delete commandeMaitrecles['_partition']
    // commandeMaitrecles.attachements = {partition: commandeMaitrecles['_partition']}

    const dataChiffre = messageChiffre.doc.data_chiffre.slice(1)  // Retirer le premier character multibase (base64)

    // message : contenu compresse (gzip) et chiffre en base64
    // commandeMaitrecles : information de dechiffrage pour le maitre des cles
    return { contenu: dataChiffre, commandeMaitrecles }
}
