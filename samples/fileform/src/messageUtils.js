import pako from 'pako'

export async function chiffrerMessage(workers, certifcatsChiffragePem, from, content, opts) {
    opts = opts || {}

    // const {connexion, chiffrage} = workers
    const { chiffrage } = workers
    const champsOptionnels = ['subject', 'to', ]

    // const toFiltre = to.split(';').map(item=>item.trim())
    // let ccFiltre = []
    // if(cc) {
    //     ccFiltre = cc.split(';').map(item=>item.trim())
    // }
    // let bccFiltre = []
    // if(bcc) {
    //     bccFiltre = bcc.split(';').map(item=>item.trim())
    // }

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
        messageBytes, 'Messagerie', certifcatsChiffragePem, 
        {DEBUG: true, identificateurs_document: {'landing': 'true'}, nojson: true, type: 'binary'}
    )
    console.debug("Message chiffre : %O", messageChiffre)

    const commandeMaitrecles = messageChiffre.commandeMaitrecles
    commandeMaitrecles.partition = commandeMaitrecles['_partition']
    delete commandeMaitrecles['_partition']

    // const destinataires = [...new Set([...toFiltre, ...ccFiltre, ...bccFiltre])]  // dedupe

    // Preparer l'enveloppe du message
    const enveloppeMessage = {
        message_chiffre: messageChiffre.doc.data_chiffre,
        hachage_bytes: commandeMaitrecles['hachage_bytes'],
        // fingerprint_certificat: messageSigne['en-tete']['fingerprint_certificat'],
    }
   
    // if(attachments) {
    //     enveloppeMessage.attachments = fuuids
    // }
    // if(fuuidAttachmentsTransfert) {
    //     enveloppeMessage.attachments = fuuidAttachmentsTransfert
    // }

    // const enveloppeMessageSigne = await connexion.formatterMessage(enveloppeMessage, 'Messagerie')
    // delete enveloppeMessageSigne['_certificat']

    // const routageMessage = {
    //     destinataires: destinataires,
    //     message: enveloppeMessageSigne,
    // }
    // if(bcc) routageMessage.bcc = bccFiltre

    // const enveloppeRoutage = await connexion.formatterMessage(
    //     routageMessage, 'Messagerie', {action: 'poster', ajouterCertificat: true})

    return { enveloppeMessage, commandeMaitrecles /*, fuuids, message */ }
}
