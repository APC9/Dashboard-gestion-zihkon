-- =============================================================================
-- 2026-10-13 · Instrucciones de uso por automatización (las envía el aviso de
-- WhatsApp "Hemos activado en tu cuenta…" al activar cada automatización).
-- Texto con formato de WhatsApp (*negrita*); editable por automatización.
-- =============================================================================
BEGIN;

ALTER TABLE automation_catalog ADD COLUMN IF NOT EXISTS usage_instructions TEXT;

UPDATE automation_catalog SET usage_instructions = E'✏️ *Cambiar tu web*\n1. Escribe *WEB*.\n2. Dime en un solo mensaje qué quieres cambiar: un texto, un precio, un horario, los colores o un tema de temporada (Navidad, verano…).\n3. Te explico el cambio y lo publico cuando respondas *SÍ*.\nPara salir en cualquier momento, escribe *CANCELAR*.'
 WHERE automation_key = 'web_whatsapp';

UPDATE automation_catalog SET usage_instructions = E'📸 *Publicar en Instagram, Facebook, TikTok y Google*\n1. Escribe *PUBLICAR*.\n2. Envía de 1 a 8 fotos, o 1 vídeo (mejor como documento para no perder calidad).\n3. Escribe *LISTO* y cuéntame en pocas palabras qué quieres comunicar.\n4. Te enseño el resumen y lo programo cuando respondas *SÍ*.\nPara ver, cambiar o eliminar tus próximas publicaciones, escribe *PUBLICACIONES*.\nPara salir en cualquier momento, escribe *CANCELAR*.'
 WHERE automation_key = 'publicaciones';

UPDATE automation_catalog SET usage_instructions = E'📍 *Publicar en tu ficha de Google*\n1. Escribe *PUBLICAR*.\n2. Envía 1 sola foto, o 1 solo vídeo de 30 segundos como máximo, de buena calidad (720p o más) y de menos de 75 MB. El vídeo envíalo como *documento* para que WhatsApp no le baje la calidad.\n3. Escribe *LISTO* y cuéntame en pocas palabras qué quieres comunicar.\n4. Te enseño el resumen y lo programo cuando respondas *SÍ*.\nPara ver, cambiar o eliminar tus próximas publicaciones, escribe *PUBLICACIONES*.\nPara salir en cualquier momento, escribe *CANCELAR*.'
 WHERE automation_key = 'publicaciones_gbp';

UPDATE automation_catalog SET usage_instructions = E'⭐ *Respuesta a reseñas*\nNo tienes que hacer nada: nos encargamos de responder las reseñas de tu ficha de Google. Si alguna necesita tu opinión, te escribiremos por aquí.'
 WHERE automation_key = 'resenas_gbp';

COMMIT;
