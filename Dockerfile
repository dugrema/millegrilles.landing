FROM docker.maple.maceroc.com:5000/millegrilles_webappbase:2023.6.0

ENV APP_FOLDER=/usr/src/app \
    NODE_ENV=production \
    PORT=443, \
    PATH_STAGING=/var/opt/millegrilles/consignation/staging/landing

EXPOSE 80 443

# Creer repertoire app, copier fichiers
# WORKDIR $APP_FOLDER

COPY . $APP_FOLDER/
RUN export NODE_OPTIONS=--openssl-legacy-provider && \
    rm -rf $APP_FOLDER/node_modules/@dugrema/millegrilles.utiljs && \
    rm -rf $APP_FOLDER/node_modules/@dugrema/millegrilles.nodejs && \
    npm install --production && \
    rm -rf /root/.npm

CMD [ "npm", "run", "server" ]
