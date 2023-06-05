import { configureStore } from '@reduxjs/toolkit'
import uploader, { uploaderMiddlewareSetup } from '@dugrema/millegrilles.reactjs/src/landing/uploaderSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: { 
      uploader, 
    },

    middleware: (getDefaultMiddleware) => {
      const uploaderMiddleware = uploaderMiddlewareSetup(workers)
      // Prepend, evite le serializability check
      return getDefaultMiddleware()
        .prepend(uploaderMiddleware.middleware)
    },
  })

  return store
}

export default storeSetup
