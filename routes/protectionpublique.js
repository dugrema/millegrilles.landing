import debugLib from 'debug'
const debug = debugLib('landing:protectionpublique')

function protectionPublique(req, res, next) {
    debug("ProtectionPublique headers\nIP %s\n%O", req.ip, req.headers)
    
    const limiteDepassee = false

    if(limiteDepassee) {
        res.setHeader('Retry-After', 300)
        return res.status(429).send()
    }

    return res.sendStatus(200)
}

export default protectionPublique