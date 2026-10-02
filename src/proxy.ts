import { clerkMiddleware } from '@clerk/nextjs/server';

// Clerk: identifica al usuario en cada petición. No protege ninguna página (la app se usa sin
// cuenta); las rutas de la API que necesitan sesión lo comprueban ellas mismas con auth().
export default clerkMiddleware();

export const config = {
  matcher: [
    // Todo menos los archivos internos de Next y los estáticos (sw.js incluido)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
