import debugLib from 'debug'
const debug = debugLib('landing:protectionpublique')

const EXPIRATION_RATE_REDIS = 300  // en secondes
const HIT_RATE_GENERAL = 100  // Hits max par periode
const HIT_RATE_TOKEN = 50     // Hits max par periode
const TYPERATE_LANDING_GENERAL = 'general',
      TYPERATE_LANDING_TOKEN = 'token'

async function protectionPublique(req, res) {
    debug("ProtectionPublique headers\nIP %s\n%O", req.ip, req.headers)
    
    const uri = req.headers['x-original-uri']
    const url = new URL('http://localhost' + uri)
    let typerate = TYPERATE_LANDING_GENERAL,
        hitrate = HIT_RATE_GENERAL

        if(url.pathname.endsWith('/public/token')) {
        typerate = TYPERATE_LANDING_TOKEN
        hitrate = HIT_RATE_TOKEN
    }

    const limiteDepassee = await appliquerRateLimit(req, typerate, {limite: hitrate})
    if(limiteDepassee) {
        res.setHeader('Retry-After', limiteDepassee)
        return res.status(429).send()
    }

    return res.sendStatus(200)
}

export default protectionPublique

// Applique un compteur de nombre d'acces dans redis pour une periode TTL
async function appliquerRateLimit(req, typeRate, opts) {
    opts = opts || {}

    const redisClient = req.redisClient  //amqpdaoInst.pki.redisClient
    const adresseExterne = req.headers['x-forwarded-for'] || req.headers['x-real-ip']
    const cleRedis = `landing:${typeRate}:${adresseExterne}`

    debug("getCleRedis Cle = %O", cleRedis)
    const quota = await redisClient.get(cleRedis)
    debug("getCleRedis Resultat chargement adresse: %s = %O", adresseExterne, quota)
    if(quota) {
        const quotaInt = Number.parseInt(quota)
        if(quotaInt > 0) {
            // Decrementer quota pour la periode TTL deja etablie
            const quotaMaj = '' + (quotaInt-1)
            redisClient.set(cleRedis, quotaMaj, {KEEPTTL: true})
        } else {
            const ttl = await redisClient.ttl(cleRedis)
            return ttl + 1  // Limite atteinte
        }
    } else {
        // Entree initiale pour la periode TTL
        const limite = opts.limite || HIT_RATE_GENERAL
        const quotaInt = Number.parseInt(limite)
        const quotaMaj = '' + (quotaInt-1)
        const expiration = opts.expiration || EXPIRATION_RATE_REDIS
        debug("Creation nouveau rate %s pour %s, expiration dans %s", quotaMaj, cleRedis, expiration)
        redisClient.set(cleRedis, quotaMaj, {NX: true, EX: expiration})
    }

    return false  // Limite n'est pas atteinte
}